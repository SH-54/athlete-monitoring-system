import { NextResponse } from "next/server";
import { configured, serverSupabase } from "@/lib/supabase";
import { bulkPayloadSchema } from "@/lib/import";
export async function POST(request: Request) {
  if (!configured())
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await db
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["administrator", "coach"].includes(profile.role))
    return NextResponse.json(
      { error: "Bulk imports require an administrator or coach." },
      { status: 403 },
    );
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1024 * 1024)
    return NextResponse.json(
      { error: "Import payload is too large." },
      { status: 413 },
    );
  const reader = request.body?.getReader();
  if (!reader)
    return NextResponse.json(
      { error: "Import body is required." },
      { status: 400 },
    );
  let bytes = 0;
  const parts: Uint8Array[] = [];
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > 1024 * 1024) {
      await reader.cancel();
      return NextResponse.json(
        { error: "Import payload is too large." },
        { status: 413 },
      );
    }
    parts.push(part.value);
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  let raw: string;
  try {
    raw = new TextDecoder("utf-8", { fatal: true }).decode(joined);
  } catch {
    return NextResponse.json(
      { error: "Invalid UTF-8 payload." },
      { status: 400 },
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = bulkPayloadSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Invalid rows. Review required fields, ranges, dates, attendance and row limit.",
      },
      { status: 400 },
    );
  const keys = parsed.data.rows.map((r) =>
    parsed.data.kind === "rpe"
      ? `${r.athlete_id}:${"session_id" in r ? r.session_id : ""}`
      : `${r.athlete_id}:${r.date}`,
  );
  if (new Set(keys).size !== keys.length)
    return NextResponse.json(
      { error: "Duplicate records in the import batch." },
      { status: 400 },
    );
  const { data, error } = await db.rpc("bulk_import_records", {
    import_kind: parsed.data.kind,
    rows: parsed.data.rows,
    overwrite_existing: parsed.data.overwrite,
  });
  return error
    ? NextResponse.json(
        {
          error:
            "Import rejected. No rows were saved. Check team permissions, session assignments, configured scales and whether session dates changed.",
        },
        { status: 403 },
      )
    : NextResponse.json({ ok: true, ...data });
}
