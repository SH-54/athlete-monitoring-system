"use client";
import { Globe } from "lucide-react";
import { locales, localeNames, isLocale } from "@/lib/locales";
import { useLanguage } from "./language-provider";

export default function LanguageSwitcher() {
  const { locale, setLocale, ready, t } = useLanguage();
  return (
    <label className="language-switcher">
      <Globe size={16} aria-hidden="true" />
      <select
        aria-label="Language"
        title={t.language}
        value={locale}
        disabled={!ready}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
      >
        {locales.map((code) => (
          <option key={code} value={code} lang={code}>
            {localeNames[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
