export const locales = ["en", "ja", "zh", "es", "pt", "fr", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "zh";
export const localeNames: Record<Locale, string> = {
  en: "English",
  ja: "日本語",
  zh: "简体中文",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
};
export const intlLocales: Record<Locale, string> = {
  en: "en-GB",
  ja: "ja-JP",
  zh: "zh-CN",
  es: "es-ES",
  pt: "pt-PT",
  fr: "fr-FR",
  de: "de-DE",
};
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}
export function formatMessage(
  message: string,
  values: Record<string, string | number>,
) {
  return message.replace(/\{(\w+)\}/g, (token, key) =>
    String(values[key] ?? token),
  );
}
