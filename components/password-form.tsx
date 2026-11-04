"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
export default function PasswordForm() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <main className="login">
      <form
        className="panel login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            if (f.get("password") !== f.get("confirm"))
              throw new Error("パスワードが一致しません。");
            const { error } = await createBrowserClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            ).auth.updateUser({ password: String(f.get("password")) });
            if (error) throw error;
            setMessage("パスワードを変更しました。チーム画面に戻れます。");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "変更できませんでした");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>新しいパスワード</h1>
        <label>
          パスワード（10文字以上）
          <input
            type="password"
            name="password"
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          もう一度入力
          <input
            type="password"
            name="confirm"
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}
        <button className="primary" disabled={busy}>
          変更する
        </button>
        <a className="secondary" href="/">
          チーム画面へ
        </a>
      </form>
    </main>
  );
}
