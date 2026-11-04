"use client";
import AuthShell from "./auth-shell";
import { useLanguage } from "./language-provider";
export default function InvalidInvitation() {
  const { t } = useLanguage();
  return (
    <AuthShell>
      <h1>{t.invalidInvitation}</h1>
      <p className="muted">{t.invalidInvitationHelp}</p>
      <a className="secondary" href="/">
        {t.backToLogin}
      </a>
    </AuthShell>
  );
}
