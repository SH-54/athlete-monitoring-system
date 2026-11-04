"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { dictionaries } from "@/lib/i18n";
import {
  defaultLocale,
  intlLocales,
  isLocale,
  type Locale,
} from "@/lib/locales";

const preferenceKey = "athlos-locale";
type LanguageContext = {
  locale: Locale;
  ready: boolean;
  setLocale: (locale: Locale) => void;
  activateUser: (id: string) => void;
};
const Context = createContext<LanguageContext | null>(null);

export function LanguageProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const [ready, setReady] = useState(false);
  const user = useRef<string | null>(null);
  const current = useRef(initialLocale);
  const apply = useCallback((next: Locale) => {
    current.current = next;
    updateLocale(next);
    document.documentElement.lang = intlLocales[next];
    document.title = `ATHLOS · ${dictionaries[next].appName}`;
    try {
      document.cookie = `${preferenceKey}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    } catch {
      /* Cookie preferences may also be disabled. */
    }
  }, []);
  useEffect(() => {
    let preferred = current.current;
    try {
      const stored = localStorage.getItem(preferenceKey);
      if (isLocale(stored)) preferred = stored;
    } catch {
      /* Storage is optional in private browsers. */
    }
    apply(preferred);
    setReady(true);
  }, [apply]);
  const setLocale = useCallback(
    (next: Locale) => {
      if (!isLocale(next)) return;
      apply(next);
      try {
        localStorage.setItem(preferenceKey, next);
        if (user.current)
          localStorage.setItem(`${preferenceKey}:${user.current}`, next);
        else localStorage.setItem(`${preferenceKey}:visitor-choice`, next);
      } catch {
        /* The current page still switches without preference storage. */
      }
    },
    [apply],
  );
  const activateUser = useCallback(
    (id: string) => {
      user.current = id;
      try {
        const visitor = localStorage.getItem(`${preferenceKey}:visitor-choice`);
        const saved = localStorage.getItem(`${preferenceKey}:${id}`);
        const next = isLocale(visitor)
          ? visitor
          : isLocale(saved)
            ? saved
            : current.current;
        apply(next);
        localStorage.setItem(preferenceKey, next);
        localStorage.setItem(`${preferenceKey}:${id}`, next);
        localStorage.removeItem(`${preferenceKey}:visitor-choice`);
      } catch {
        /* An unavailable preference store does not block login. */
      }
    },
    [apply],
  );
  return (
    <Context.Provider value={{ locale, ready, setLocale, activateUser }}>
      {children}
    </Context.Provider>
  );
}

export function useLanguage(userId?: string) {
  const context = useContext(Context);
  if (!context) throw new Error("LanguageProvider is required");
  const { activateUser, ready, locale } = context;
  useEffect(() => {
    if (userId && ready) activateUser(userId);
  }, [userId, ready, activateUser]);
  return {
    ...context,
    t: dictionaries[locale],
    intlLocale: intlLocales[locale],
    number: (value: number | null, digits = 0) =>
      value === null
        ? "—"
        : value.toLocaleString(intlLocales[locale], {
            maximumFractionDigits: digits,
          }),
  };
}
