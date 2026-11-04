"use client";
import { useLanguage } from "./language-provider";
export default function DemoNavigation() {
  const { t } = useLanguage();
  return (
    <div className="demo-role-bar">
      <strong>{t.demoRoles}</strong>
      <a href="/demo?role=athlete">{t.athlete}</a>
      <a href="/demo?role=coach">{t.roleCoach}</a>
      <a href="/demo?role=administrator">{t.roleAdministrator}</a>
      <a href="/">{t.normalDemo}</a>
    </div>
  );
}
