"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import AuthShell from "./auth-shell";
import { useLanguage } from "./language-provider";
import { authErrorKey } from "@/lib/localized-errors";
import type { Labels } from "@/lib/i18n";

export default function Login({ error }: { error?: string }) {
  const { t } = useLanguage();
  const [notice, setNotice] = useState<keyof Labels | null>(
    error ? "accountLoadError" : null,
  );
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  function changeMode(next: typeof mode) {
    setMode(next);
    setNotice(null);
  }
  return (
    <AuthShell>
      <p className="eyebrow">{t.appName}</p>
      <h1>
        {mode === "login"
          ? t.login
          : mode === "signup"
            ? t.adminSignup
            : t.resetPassword}
      </h1>
      <p className="muted">
        {mode === "signup"
          ? t.signupHelp
          : mode === "reset"
            ? t.resetHelp
            : t.loginHelp}
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setNotice(null);
          const form = new FormData(event.currentTarget);
          try {
            const db = createBrowserClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            );
            const email = String(form.get("email"));
            if (mode === "reset") {
              const redirect = new URL("/auth/callback", location.origin);
              redirect.searchParams.set("next", "/account/password");
              const { error } = await db.auth.resetPasswordForEmail(email, {
                redirectTo: redirect.toString(),
              });
              if (error) throw error;
              setNotice("resetSent");
            } else if (mode === "signup") {
              const { data, error } = await db.auth.signUp({
                email,
                password: String(form.get("password")),
                options: {
                  emailRedirectTo: location.origin + "/auth/callback",
                },
              });
              if (error) throw error;
              if (data.session) location.reload();
              else setNotice("confirmationSent");
            } else {
              const { error } = await db.auth.signInWithPassword({
                email,
                password: String(form.get("password")),
              });
              if (error) throw error;
              location.reload();
            }
          } catch (error) {
            setNotice(authErrorKey(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t.email}
          <input name="email" type="email" autoComplete="username" required />
        </label>
        {mode !== "reset" && (
          <label>
            {mode === "signup" ? t.passwordMin : t.password}
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
        {notice && (
          <p role="status" className="auth-message">
            {t[notice]}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? t.busy
            : mode === "login"
              ? t.login
              : mode === "signup"
                ? t.sendConfirmation
                : t.sendReset}
        </button>
      </form>
      <div className="auth-links">
        <button
          className="text-button"
          onClick={() => changeMode(mode === "reset" ? "login" : "reset")}
        >
          {mode === "reset" ? t.backToLogin : t.forgotPassword}
        </button>
        <button
          className="text-button"
          onClick={() => changeMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup" ? t.backToLogin : t.firstAdmin}
        </button>
      </div>
    </AuthShell>
  );
}
