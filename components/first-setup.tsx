"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
export default function FirstSetup() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="login">
      <section className="panel login-card">
        <div className="brand">
          <span className="brand-icon">A</span> ATHLOS
        </div>
        <h1>チームを作成</h1>
        <p className="muted">
          最初の管理者として組織とチームを作成します。招待された選手・スタッフは、管理者から受け取った招待リンクを開いてください。
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const db = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
              );
              const { error } = await db.rpc("bootstrap_organization", {
                org_name: String(f.get("org")),
                team_name: String(f.get("team")),
              });
              if (error)
                throw new Error(
                  "作成できませんでした。メール認証とDBマイグレーションの適用を確認してください。",
                );
              location.reload();
            } catch (e) {
              setError(e instanceof Error ? e.message : "作成に失敗しました");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            組織名
            <input name="org" maxLength={100} required placeholder="クラブ名" />
          </label>
          <label>
            チーム名
            <input
              name="team"
              maxLength={100}
              required
              placeholder="トップチーム"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "作成中…" : "チームを作成する"}
          </button>
        </form>
        <p className="setup-note">
          このアカウントが管理者になります。選手には設定画面から招待リンクを発行します。
        </p>
        <button
          className="text-button"
          onClick={async () => {
            await createBrowserClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            ).auth.signOut();
            location.reload();
          }}
        >
          ログアウト
        </button>
      </section>
    </main>
  );
}
