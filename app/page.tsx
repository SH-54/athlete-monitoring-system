import Monitor from "@/components/monitor";
import Login from "@/components/login";
import { serverSupabase } from "@/lib/supabase";
import { serverMode } from "@/lib/runtime";
import ConnectionRequired from "@/components/connection-required";
import FirstSetup from "@/components/first-setup";
import { loadData } from "@/lib/data";
import { makeDemo } from "@/lib/demo";
export const dynamic = "force-dynamic";
export default async function Page() {
  const mode = serverMode();
  if (mode === "unconfigured") return <ConnectionRequired />;
  if (mode === "demo")
    return (
      <Monitor
        initialData={makeDemo()}
        demo
        viewer={{ id: "demo", name: "Alex Morgan", role: "administrator" }}
      />
    );
  try {
    const db = await serverSupabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return <Login />;
    const profile = await db
      .from("user_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile.error) throw new Error("接続先のスキーマを確認してください。");
    if (!profile.data) return <FirstSetup />;
    const result = await loadData();
    return result ? (
      <Monitor initialData={result.data} viewer={result.viewer} demo={false} />
    ) : (
      <Login />
    );
  } catch (e) {
    return (
      <Login
        error={e instanceof Error ? e.message : "Unable to load account"}
      />
    );
  }
}
