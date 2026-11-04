import { NextResponse } from "next/server";
import { configured, serverSupabase } from "@/lib/supabase";
import { wellnessSchema } from "@/lib/validation";
export async function POST(request: Request) {
  if (!configured())
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = wellnessSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { data: org } = await db
    .from("organizations")
    .select("settings")
    .single();
  for (const key of [
    "sleep_quality",
    "fatigue",
    "soreness",
    "stress",
    "appetite",
  ] as const) {
    const scale = org?.settings?.scales?.[key] ?? { min: 1, max: 5 };
    if (parsed.data[key] < scale.min || parsed.data[key] > scale.max)
      return NextResponse.json(
        { error: `${key} outside configured scale` },
        { status: 400 },
      );
  }
  const { error } = await db.rpc("save_wellness", { payload: parsed.data });
  return error
    ? NextResponse.json(
        { error: "Save rejected. Check your permissions and values." },
        { status: 403 },
      )
    : NextResponse.json({ ok: true });
}
