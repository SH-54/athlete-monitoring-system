import { NextResponse } from "next/server";
import { serverMode } from "@/lib/runtime";
import { loadData } from "@/lib/data";
export async function GET() {
  if (serverMode() !== "live")
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  try {
    const result = await loadData();
    return result
      ? NextResponse.json(result, {
          headers: { "Cache-Control": "private, no-store" },
        })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch {
    return NextResponse.json(
      { error: "データを同期できません。通信と接続先をご確認ください。" },
      { status: 503 },
    );
  }
}
