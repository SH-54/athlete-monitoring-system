"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
export default function JoinForm({
  token,
  email,
  loggedIn,
}: {
  token: string;
  email?: string;
  loggedIn: boolean;
}) {
  const [mode, setMode] = useState<"signup" | "login">("signup"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <section className="panel login-card">
        <div className="brand">
          <span className="brand-icon">A</span> ATHLOS
        </div>
        <h1>チームへの招待</h1>
        <p className="muted">
          管理者に伝えたメールアドレスで登録・認証してください。役割と担当チームは招待内容から設定されます。
        </p>
        {loggedIn ? (
          <>
            <p className="setup-note">ログイン中：{email}</p>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const db = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
                  );
                  const { error } = await db.rpc("claim_invitation", {
                    raw_token: token,
                  });
                  if (error)
                    throw new Error(
                      "招待を受けられません。招待先のメール、メール認証、7日間の期限をご確認ください。既に別組織へ登録済みの場合は管理者にご連絡ください。",
                    );
                  location.assign("/");
                } catch (e) {
                  setMessage(
                    e instanceof Error ? e.message : "登録できませんでした",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              招待を受けてチームを開く
            </button>
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
              別のアカウントでログイン
            </button>
          </>
        ) : (
          <>
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
                  const email = String(f.get("email")),
                    password = String(f.get("password"));
                  if (mode === "login") {
                    const { error } = await db.auth.signInWithPassword({
                      email,
                      password,
                    });
                    if (error) throw error;
                    location.reload();
                  } else {
                    const callback = new URL("/auth/callback", location.origin);
                    callback.searchParams.set("next", "/join?token=" + token);
                    const { data, error } = await db.auth.signUp({
                      email,
                      password,
                      options: { emailRedirectTo: callback.toString() },
                    });
                    if (error) throw error;
                    if (data.session) location.reload();
                    else
                      setMessage(
                        "確認メールを送りました。メール内のリンクを開き、招待を受けてください。",
                      );
                  }
                } catch (e) {
                  setMessage(
                    e instanceof Error ? e.message : "接続できませんでした",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                招待されたメールアドレス
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                />
              </label>
              <label>
                パスワード{mode === "signup" ? "（10文字以上）" : ""}
                <input
                  name="password"
                  type="password"
                  minLength={mode === "signup" ? 10 : 1}
                  maxLength={128}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy
                  ? "処理中…"
                  : mode === "signup"
                    ? "アカウントを作成"
                    : "ログイン"}
              </button>
            </form>
            <button
              className="text-button"
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            >
              {mode === "signup"
                ? "アカウントがある方はこちら"
                : "新しく登録する"}
            </button>
          </>
        )}
        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
