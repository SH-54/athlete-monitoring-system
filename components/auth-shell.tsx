"use client";
import LanguageSwitcher from "./language-switcher";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="login">
      <section className="panel login-card">
        <div className="auth-language">
          <LanguageSwitcher />
        </div>
        <div className="brand">
          <span className="brand-icon">A</span> ATHLOS
        </div>
        {children}
      </section>
    </main>
  );
}
