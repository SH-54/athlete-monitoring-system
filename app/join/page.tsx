import { serverMode } from "@/lib/runtime";
import { serverSupabase } from "@/lib/supabase";
import JoinForm from "@/components/join-form";
import ConnectionRequired from "@/components/connection-required";
export const dynamic = "force-dynamic";
export default async function Join({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (serverMode() !== "live") return <ConnectionRequired />;
  const { token } = await searchParams;
  if (!token || !/^[0-9a-f]{64}$/.test(token))
    return (
      <main className="login">
        <section className="panel login-card">
          <h1>招待リンクを確認してください</h1>
          <p>管理者から届いた完全なリンクを開いてください。</p>
          <a className="secondary" href="/">
            ログインへ
          </a>
        </section>
      </main>
    );
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  return <JoinForm token={token} email={user?.email} loggedIn={!!user} />;
}
