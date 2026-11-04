"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
export default function Login({ error }: { error?: string }) {
  const [message, setMessage] = useState(error ?? ""),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  return (
    <main className="login">
      <section className="panel login-card">
        <div className="brand">
          <span className="brand-icon">A</span> ATHLOS
        </div>
        <p className="eyebrow">ATHLETE MONITORING SYSTEM</p>
        <h1>
          {mode === "login"
            ? "ログイン"
            : mode === "signup"
              ? "管理者アカウント登録"
              : "パスワード再設定"}
        </h1>
        <p className="muted">
          {mode === "signup"
            ? "新しい組織の管理者用です。招待された選手・スタッフは招待リンクから登録してください。"
            : mode === "reset"
              ? "登録メールアドレスへ再設定リンクを送ります。"
              : "選手は自分の記録を入力し、コーチは担当チームを確認・代理入力できます。"}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            const f = new FormData(e.currentTarget);
            try {
              const db = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
              );
              const email = String(f.get("email"));
              if (mode === "reset") {
                const redirect = new URL("/auth/callback", location.origin);
                redirect.searchParams.set("next", "/account/password");
                const { error } = await db.auth.resetPasswordForEmail(email, {
                  redirectTo: redirect.toString(),
                });
                if (error) throw error;
                setMessage(
                  "登録がある場合は再設定メールが届きます。メールをご確認ください。",
                );
              } else if (mode === "signup") {
                const { data, error } = await db.auth.signUp({
                  email,
                  password: String(f.get("password")),
                  options: {
                    emailRedirectTo: location.origin + "/auth/callback",
                  },
                });
                if (error) throw error;
                if (data.session) location.reload();
                else
                  setMessage(
                    "確認メールを送りました。メール内のリンクで認証してからログインしてください。",
                  );
              } else {
                const { error } = await db.auth.signInWithPassword({
                  email,
                  password: String(f.get("password")),
                });
                if (error) throw error;
                location.reload();
              }
            } catch (e) {
              setMessage(
                e instanceof Error
                  ? e.message
                  : "接続できませんでした。再度お試しください。",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            メールアドレス
            <input name="email" type="email" autoComplete="username" required />
          </label>
          {mode !== "reset" && (
            <label>
              パスワード
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                minLength={mode === "signup" ? 10 : 1}
                maxLength={128}
                required
              />
            </label>
          )}
          {message && (
            <p role="status" className="auth-message">
              {message}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "処理中…"
              : mode === "login"
                ? "ログイン"
                : mode === "signup"
                  ? "確認メールを送る"
                  : "再設定メールを送る"}
          </button>
        </form>
        <div className="auth-links">
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === "reset" ? "login" : "reset");
              setMessage("");
            }}
          >
            {mode === "reset" ? "ログインに戻る" : "パスワードを忘れた方"}
          </button>
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setMessage("");
            }}
          >
            {mode === "signup"
              ? "ログインに戻る"
              : "初めて組織を作成する管理者の方"}
          </button>
        </div>
      </section>
    </main>
  );
}
