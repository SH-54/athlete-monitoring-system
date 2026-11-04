"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import AuthShell from "./auth-shell";
import { useLanguage } from "./language-provider";
import { authErrorKey } from "@/lib/localized-errors";
import type { Labels } from "@/lib/i18n";

export default function JoinForm({
  token,
  email,
  loggedIn,
}: {
  token: string;
  email?: string;
  loggedIn: boolean;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [notice, setNotice] = useState<keyof Labels | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthShell>
      <h1>{t.teamInvitation}</h1>
      <p className="muted">{t.joinHelp}</p>
      {loggedIn ? (
        <>
          <p className="setup-note">
            {t.signedInAs}: {email}
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setNotice(null);
              try {
                const db = createBrowserClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
                );
                const { error } = await db.rpc("claim_invitation", {
                  raw_token: token,
                });
                if (error) throw error;
                location.assign("/");
              } catch {
                setNotice("invitationError");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t.busy : t.acceptInvitation}
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
            {t.otherAccount}
          </button>
        </>
      ) : (
        <>
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
                const email = String(form.get("email")),
                  password = String(form.get("password"));
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
                  else setNotice("joinConfirmed");
                }
              } catch (error) {
                setNotice(authErrorKey(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t.inviteEmail}
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
              />
            </label>
            <label>
              {mode === "signup" ? t.passwordMin : t.password}
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
              {busy ? t.busy : mode === "signup" ? t.createAccount : t.login}
            </button>
          </form>
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setNotice(null);
            }}
          >
            {mode === "signup" ? t.haveAccount : t.newAccount}
          </button>
        </>
      )}
      {notice && (
        <p className="auth-message" role="status">
          {t[notice]}
        </p>
      )}
    </AuthShell>
  );
}
