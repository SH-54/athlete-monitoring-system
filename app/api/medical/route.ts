import { z } from "zod";
import { NextResponse } from "next/server";
import { configured, serverSupabase } from "@/lib/supabase";
export async function GET() {
  if (!configured())
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await db
    .from("medical_notes")
    .select("id,athlete_id,note,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return error
    ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
    : NextResponse.json({ notes: data });
}
export async function POST(request: Request) {
  if (!configured())
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = z
    .object({ athlete_id: z.uuid(), note: z.string().trim().min(1).max(5000) })
    .safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { data, error } = await db
    .from("medical_notes")
    .insert({ ...p.data, author_id: user.id })
    .select("id,athlete_id,note,created_at")
    .single();
  return error
    ? NextResponse.json({ error: "Save rejected" }, { status: 403 })
    : NextResponse.json({ note: data });
}
