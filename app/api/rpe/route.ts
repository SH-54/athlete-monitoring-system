import { NextResponse } from "next/server";
import { configured, serverSupabase } from "@/lib/supabase";
import { rpeSchema } from "@/lib/validation";
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
  const parsed = rpeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { athlete_id, session_id, ...values } = parsed.data;
  if (!["attended", "rehabilitation"].includes(values.status)) {
    values.minutes = 0;
    values.rpe = null;
  }
  const { data, error } = await db
    .from("athlete_sessions")
    .update(values)
    .eq("athlete_id", athlete_id)
    .eq("session_id", session_id)
    .select("athlete_id");
  return error || !data?.length
    ? NextResponse.json(
        { error: "Save rejected. Check assignment and permissions." },
        { status: 403 },
      )
    : NextResponse.json({ ok: true });
}
