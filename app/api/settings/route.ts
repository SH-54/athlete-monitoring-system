import { z } from "zod";
import { thresholdErrors } from "@/lib/analytics";
import { NextResponse } from "next/server";
import { configured, serverSupabase } from "@/lib/supabase";
const scale = z
  .object({
    min: z.number().int().min(0).max(9),
    max: z.number().int().min(1).max(10),
    direction: z.enum(["higher_better", "higher_worse"]),
  })
  .refine((s) => s.max > s.min);
const schema = z
  .object({
    sleepMin: z.number().min(0).max(24),
    sleepRedMin: z.number().min(0).max(24).default(5),
    fatigueMax: z.number().min(0).max(10),
    fatigueRed: z.number().min(0).max(10).default(5),
    painMin: z.number().min(0).max(10),
    painRedMin: z.number().min(0).max(10).default(5),
    weightChangePct: z.number().min(0).max(100),
    loadMax: z.number().min(0).max(6000),
    loadRedMax: z.number().min(0).max(6000).default(1000),
    loadSpikePct: z.number().min(0).max(1000),
    sleepQualityDrop: z.number().min(0).max(10),
    newPainMin: z.number().min(0).max(10),
    wellnessDeviation: z.number().min(0).max(10),
    acwr: z.enum(["coupled", "uncoupled", "ewma"]),
    scales: z.object({
      sleep_quality: scale,
      fatigue: scale,
      soreness: scale,
      stress: scale,
      appetite: scale,
    }),
  })
  .superRefine((settings, ctx) => {
    for (const message of thresholdErrors(settings))
      ctx.addIssue({ code: "custom", message });
  });
export async function POST(request: Request) {
  if (!configured())
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  const { data: p } = await db
    .from("user_profiles")
    .select("role,organization_id")
    .eq("id", user.id)
    .single();
  if (p?.role !== "administrator")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { error } = await db
    .from("organizations")
    .update({ settings: parsed.data })
    .eq("id", p.organization_id);
  return error
    ? NextResponse.json({ error: "Save rejected" }, { status: 403 })
    : NextResponse.json({ ok: true });
}
