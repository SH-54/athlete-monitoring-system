import { NextResponse } from "next/server";
import { configured, serverSupabase } from "@/lib/supabase";
import { sessionWriteSchema } from "@/lib/validation";
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
  const parsed = sessionWriteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { data, error } = await db.rpc(
    parsed.data.id ? "edit_session" : "create_session",
    {
      payload: parsed.data,
    },
  );
  return error
    ? NextResponse.json(
        {
          error:
            "Session rejected. Check permissions, team membership and session code.",
        },
        { status: 403 },
      )
    : NextResponse.json({ id: data });
}
