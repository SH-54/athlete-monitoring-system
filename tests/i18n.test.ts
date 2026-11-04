import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries } from "../lib/i18n";
import { locales, isLocale, formatMessage } from "../lib/locales";
import { authErrorKey, importIssue } from "../lib/localized-errors";
import { LanguageProvider } from "../components/language-provider";
import Login from "../components/login";
import JoinForm from "../components/join-form";
import PasswordForm from "../components/password-form";
import FirstSetup from "../components/first-setup";
import ConnectionRequired from "../components/connection-required";

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
test("all seven translation catalogs have every message and preserve interpolation fields", () => {
  assert.deepEqual([...locales].sort(), [
    "de",
    "en",
    "es",
    "fr",
    "ja",
    "pt",
    "zh",
  ]);
  const reference = Object.keys(dictionaries.en).sort();
  for (const locale of locales) {
    assert.deepEqual(Object.keys(dictionaries[locale]).sort(), reference);
    for (const key of reference as (keyof typeof dictionaries.en)[]) {
      const value = dictionaries[locale][key];
      assert.ok(value.trim(), `${locale}:${key}`);
      assert.deepEqual(
        placeholders(value),
        placeholders(dictionaries.en[key]),
        `${locale}:${key}`,
      );
    }
  }
});
test("login, invitations, password reset, first setup and connection screen render in every selected language", () => {
  for (const locale of locales) {
    const t = dictionaries[locale];
    const screens = [
      [createElement(Login), t.login],
      [
        createElement(JoinForm, { token: "a".repeat(64), loggedIn: false }),
        t.teamInvitation,
      ],
      [createElement(PasswordForm), t.newPassword],
      [createElement(FirstSetup), t.createTeam],
      [createElement(ConnectionRequired), t.connectionRequired],
    ] as const;
    for (const [screen, heading] of screens) {
      const html = renderToStaticMarkup(
        createElement(LanguageProvider, {
          initialLocale: locale,
          children: screen,
        }),
      );
      const escaped = heading
        .replaceAll("&", "&amp;")
        .replaceAll("'", "&#x27;");
      assert.ok(html.includes(`<h1>${escaped}</h1>`), `${locale}:${heading}`);
      assert.equal((html.match(/<option /g) ?? []).length, 7);
      const selected = html.match(/<option\b[^>]*selected=""[^>]*>/)?.[0];
      assert.ok(selected?.includes(`value="${locale}"`));
    }
  }
});
test("language inputs are allowlisted and interpolated zero counts are preserved", () => {
  assert.ok(isLocale("es"));
  assert.ok(isLocale("pt"));
  assert.equal(isLocale("constructor"), false);
  assert.equal(isLocale(null), false);
  assert.equal(
    formatMessage(dictionaries.en.importSaved, { saved: 0, skipped: 3 }),
    "Saved 0; kept 3 existing records.",
  );
});
test("authentication errors use translatable categories without exposing provider diagnostics", () => {
  assert.equal(
    authErrorKey({ code: "invalid_credentials" }),
    "invalidCredentials",
  );
  assert.equal(
    authErrorKey({ code: "email_not_confirmed" }),
    "emailUnconfirmed",
  );
  assert.equal(
    authErrorKey({ code: "over_email_send_rate_limit" }),
    "emailLimit",
  );
  assert.equal(
    authErrorKey(new Error("private provider diagnostic")),
    "connectionError",
  );
});
test("spreadsheet errors retain actionable row and range information in the selected language", () => {
  const t = dictionaries.es;
  assert.equal(
    importIssue("Duplicate athlete/date/session; first appears at row 4.", t),
    "Deportista, fecha y sesión duplicados. La primera entrada está en la fila 4.",
  );
  assert.equal(importIssue("fatigue must be 1–5.", t), "Fatiga: 1–5.");
  assert.equal(
    importIssue("Unknown or ambiguous session for this date and team.", t),
    t.importUnknownSession,
  );
  assert.equal(
    importIssue("Formula cells are not accepted. Paste values only.", t),
    t.importFormulaError,
  );
});
