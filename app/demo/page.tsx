import { serverMode } from "@/lib/runtime";
import { redirect } from "next/navigation";
import { demoView } from "@/lib/demo-view";
import Monitor from "@/components/monitor";
import DemoNavigation from "@/components/demo-navigation";
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
      <DemoNavigation />
      <Monitor initialData={data} viewer={viewer} demo />
    </>
  );
}
