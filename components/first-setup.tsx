"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import AuthShell from "./auth-shell";
import { useLanguage } from "./language-provider";

export default function FirstSetup() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  return (
    <AuthShell>
      <h1>{t.createTeam}</h1>
      <p className="muted">{t.setupHelp}</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(false);
          const form = new FormData(event.currentTarget);
          try {
            const db = createBrowserClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            );
            const { error } = await db.rpc("bootstrap_organization", {
              org_name: String(form.get("org")),
              team_name: String(form.get("team")),
            });
            if (error) throw error;
            location.reload();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t.organizationName}
          <input
            name="org"
            maxLength={100}
            required
            placeholder={t.clubPlaceholder}
          />
        </label>
        <label>
          {t.teamName}
          <input
            name="team"
            maxLength={100}
            required
            placeholder={t.teamPlaceholder}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {t.setupError}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? t.busy : t.createTeam}
        </button>
      </form>
      <p className="setup-note">{t.setupNote}</p>
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
        {t.logout}
      </button>
    </AuthShell>
  );
}
