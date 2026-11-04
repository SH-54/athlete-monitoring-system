"use client";
import AuthShell from "./auth-shell";
import { useLanguage } from "./language-provider";
export default function ConnectionRequired() {
  const { t } = useLanguage();
  return (
    <AuthShell>
      <h1>{t.connectionRequired}</h1>
      <p className="muted">{t.connectionHelp}</p>
      <p className="setup-note">{t.connectionAdmin}</p>
    </AuthShell>
  );
}
