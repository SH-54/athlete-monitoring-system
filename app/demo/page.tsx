import { serverMode } from "@/lib/runtime";
import { redirect } from "next/navigation";
import { demoView } from "@/lib/demo-view";
import Monitor from "@/components/monitor";
import ConnectionRequired from "@/components/connection-required";
import type { Role } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Demo({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const mode = serverMode();
  if (mode === "live") redirect("/");
  if (mode !== "demo") return <ConnectionRequired />;
  const { role: r } = await searchParams;
  const role: Role = r === "athlete" || r === "coach" ? r : "administrator";
  const { data, viewer } = demoView(role);
  return (
    <>
      <div className="demo-role-bar">
        <strong>架空データの役割デモ</strong>
        <a href="/demo?role=athlete">選手本人の入力</a>
        <a href="/demo?role=coach">コーチの閲覧・代理入力</a>
        <a href="/demo?role=administrator">管理者</a>
        <a href="/">通常デモ</a>
      </div>
      <Monitor initialData={data} viewer={viewer} demo />
    </>
  );
}
