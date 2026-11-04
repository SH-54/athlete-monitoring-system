import type { Locale } from "./locales";
import en from "./messages/en.json";
import ja from "./messages/ja.json";
import zh from "./messages/zh.json";
import es from "./messages/es.json";
import pt from "./messages/pt.json";
import fr from "./messages/fr.json";
import de from "./messages/de.json";

export type Labels = typeof en;
// Every locale must supply every key. Missing translations fail type checking.
export const dictionaries: Record<Locale, Labels> = {
  en,
  ja,
  zh,
  es,
  pt,
  fr,
  de,
};

export function sessionTypeLabel(value: string, t: Labels) {
  const types: Record<string, string> = {
    Field: t.sessionTypeField,
    Gym: t.sessionTypeGym,
    Rehabilitation: t.sessionTypeRehabilitation,
    Match: t.sessionTypeMatch,
    Other: t.sessionTypeOther,
  };
  return types[value] ?? value;
}

export function roleLabel(value: string, t: Labels) {
  const roles: Record<string, string> = {
    administrator: t.roleAdministrator,
    coach: t.roleCoach,
    medical: t.roleMedical,
    athlete: t.athlete,
  };
  return roles[value] ?? value;
}
