import { NextResponse } from "next/server";
import { z } from "zod";
import { configured, serverSupabase } from "@/lib/supabase";
const uuid = z.uuid();
const payload = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("team"),
    id: uuid.optional(),
    name: z.string().trim().min(1).max(100),
  }),
  z.object({
    kind: z.literal("athlete"),
    id: uuid.optional(),
    name: z.string().trim().min(1).max(100),
    number: z.number().int().min(0).max(999),
    position: z.enum(["GK", "DF", "MF", "FW"]),
    team_id: uuid,
    user_id: z.union([uuid, z.literal("")]),
  }),
  z.object({
    kind: z.literal("profile"),
    id: uuid,
    name: z.string().trim().min(1).max(100),
    role: z.enum(["administrator", "coach", "medical", "athlete"]),
  }),
  z
    .object({
      kind: z.literal("permission"),
      user_id: uuid,
      team_id: uuid.nullable(),
      athlete_id: uuid.nullable(),
    })
    .refine((v) => (v.team_id === null) !== (v.athlete_id === null)),
  z.object({ kind: z.literal("revoke"), id: uuid }),
]);
async function context() {
  if (!configured()) return null;
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data: p } = await db
    .from("user_profiles")
    .select("role,organization_id")
    .eq("id", user.id)
    .single();
  return p?.role === "administrator" ? { db, org: p.organization_id } : null;
}
export async function GET() {
  const c = await context();
  if (!c) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [profiles, permissions, audit] = await Promise.all([
    c.db.from("user_profiles").select("id,name,role").order("name"),
    c.db.from("staff_permissions").select("*"),
    c.db
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (profiles.error || permissions.error || audit.error)
    return NextResponse.json(
      { error: "Unable to load management data" },
      { status: 500 },
    );
  return NextResponse.json({
    profiles: profiles.data,
    permissions: permissions.data,
    audit: audit.data,
  });
}
export async function POST(request: Request) {
  const c = await context();
  if (!c) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = payload.safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "Invalid management input" },
      { status: 400 },
    );
  const v = p.data;
  let error;
  if (v.kind === "team") {
    const result = v.id
      ? await c.db.from("teams").update({ name: v.name }).eq("id", v.id)
      : await c.db
          .from("teams")
          .insert({ name: v.name, organization_id: c.org });
    error = result.error;
  } else if (v.kind === "athlete") {
    ({ error } = await c.db.rpc("save_athlete", { payload: v }));
  } else if (v.kind === "profile") {
    ({ error } = await c.db.from("user_profiles").upsert({
      id: v.id,
      name: v.name,
      role: v.role,
      organization_id: c.org,
    }));
  } else if (v.kind === "revoke") {
    ({ error } = await c.db.from("staff_permissions").delete().eq("id", v.id));
  } else {
    const { data: staff } = await c.db
      .from("user_profiles")
      .select("role")
      .eq("id", v.user_id)
      .single();
    if (
      !staff ||
      !["coach", "medical"].includes(staff.role) ||
      (staff.role === "coach" && !v.team_id)
    )
      return NextResponse.json(
        {
          error:
            "Coaches require team permissions; individual athlete access is for medical staff.",
        },
        { status: 400 },
      );
    ({ error } = await c.db.from("staff_permissions").insert({
      user_id: v.user_id,
      team_id: v.team_id,
      athlete_id: v.athlete_id,
    }));
  }
  return error
    ? NextResponse.json(
        {
          error:
            "Save rejected. Check organization, existing Auth user, role, and duplicate permissions.",
        },
        { status: 403 },
      )
    : NextResponse.json({ ok: true });
}
