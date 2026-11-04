import { z } from "zod";
import { NextResponse } from "next/server";
import { serverSupabase, configured } from "@/lib/supabase";
const schema = z.object({
  email: z.email().max(254),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["athlete", "coach", "medical", "administrator"]),
  team_id: z.uuid().nullable(),
  athlete_id: z.uuid().nullable(),
});
async function admin() {
  if (!configured()) return null;
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data: p } = await db
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return p?.role === "administrator" ? db : null;
}
export async function GET() {
  const db = await admin();
  if (!db) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await db
    .from("invitations")
    .select("id,email,name,role,expires_at,accepted_at,revoked_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return error
    ? NextResponse.json(
        { error: "招待データを取得できません。追加SQLを確認してください。" },
        { status: 500 },
      )
    : NextResponse.json({ invitations: data });
}
export async function POST(request: Request) {
  const db = await admin();
  if (!db) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = schema.safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "入力内容を確認してください。" },
      { status: 400 },
    );
  const v = p.data;
  const { data, error } = await db.rpc("create_invitation", {
    invite_email: v.email,
    invite_name: v.name,
    invite_role: v.role,
    invite_team: v.team_id,
    invite_athlete: v.athlete_id,
  });
  return error
    ? NextResponse.json(
        {
          error:
            "招待を作成できません。担当チームと未連携の選手を確認してください。",
        },
        { status: 400 },
      )
    : NextResponse.json(data);
}
export async function DELETE(request: Request) {
  const db = await admin();
  if (!db) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = z
    .object({ id: z.uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const { error } = await db.rpc("revoke_invitation", {
    invitation_id: p.data.id,
  });
  return error
    ? NextResponse.json(
        { error: "招待を取り消せませんでした。" },
        { status: 400 },
      )
    : NextResponse.json({ ok: true });
}
