import { NextResponse } from "next/server";
import { serverSupabase, configured } from "@/lib/supabase";
import { safeNext } from "@/lib/runtime";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  if (configured() && url.searchParams.get("code")) {
    const db = await serverSupabase();
    const { error } = await db.auth.exchangeCodeForSession(
      url.searchParams.get("code")!,
    );
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(
    new URL("/?auth_error=verification", url.origin),
  );
}
