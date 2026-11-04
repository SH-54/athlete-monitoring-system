import type { Metadata, Viewport } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/components/language-provider";
import { defaultLocale, intlLocales, isLocale } from "@/lib/locales";
export const metadata: Metadata = {
  title: "ATHLOS · Athlete Monitoring",
  description:
    "Daily clarity. Better performance. Athlete wellness and training load monitoring.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-180.png" },
  appleWebApp: { capable: true, title: "ATHLOS", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#334a36",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const saved = (await cookies()).get("athlos-locale")?.value;
  const locale = isLocale(saved) ? saved : defaultLocale;
  return (
    <html lang={intlLocales[locale]}>
      <body>
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
