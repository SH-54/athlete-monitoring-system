"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import AuthShell from "./auth-shell";
import { useLanguage } from "./language-provider";
import { authErrorKey } from "@/lib/localized-errors";
import type { Labels } from "@/lib/i18n";

export default function PasswordForm() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<keyof Labels | null>(null);
  return (
    <AuthShell>
      <h1>{t.newPassword}</h1>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setNotice(null);
          const form = new FormData(event.currentTarget);
          if (form.get("password") !== form.get("confirm")) {
            setNotice("passwordMismatch");
            return;
          }
          setBusy(true);
          try {
            const { error } = await createBrowserClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            ).auth.updateUser({ password: String(form.get("password")) });
            if (error) throw error;
            setNotice("passwordChanged");
          } catch (error) {
            setNotice(authErrorKey(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t.passwordMin}
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
          {t.confirmPassword}
          <input
            type="password"
            name="confirm"
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        {notice && (
          <p className="auth-message" role="status">
            {t[notice]}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? t.busy : t.changePassword}
        </button>
      </form>
      <a className="secondary" href="/">
        {t.teamHome}
      </a>
    </AuthShell>
  );
}
