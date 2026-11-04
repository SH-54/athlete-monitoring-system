import { test, expect } from "@playwright/test";
import { dictionaries } from "../../lib/i18n";
import { locales, intlLocales } from "../../lib/locales";

test.beforeEach(async ({ page }) => {
  // This suite checks UI with fictional credentials. No request may reach a real auth service.
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname)
      ? route.continue()
      : route.abort();
  });
});

test("login, administrator signup, password reset and errors switch in all seven languages on mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const language = page.getByLabel("Language", { exact: true });
  await expect(language.locator("option")).toHaveCount(7);
  for (const locale of locales) {
    const t = dictionaries[locale];
    await language.selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute(
      "lang",
      intlLocales[locale],
    );
    await expect(page).toHaveTitle(`ATHLOS · ${t.appName}`);
    await expect(
      page.getByRole("heading", { name: t.login, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: t.firstAdmin, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: t.adminSignup, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel(t.passwordMin, { exact: true }),
    ).toHaveAttribute("minlength", "10");
    await page
      .getByRole("button", { name: t.backToLogin, exact: true })
      .click();
    await page
      .getByRole("button", { name: t.forgotPassword, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: t.resetPassword, exact: true }),
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await page
      .getByLabel(t.email, { exact: true })
      .fill("language-test@example.invalid");
    await page.getByRole("button", { name: t.sendReset, exact: true }).click();
    await expect(page.getByRole("status")).toContainText(t.connectionError);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: t.backToLogin, exact: true })
      .click();
  }
  await page.screenshot({
    path: "/tmp/athlos-login-german.png",
    fullPage: true,
  });
  await page.getByLabel("Language", { exact: true }).selectOption("ja");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ログイン", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/athlos-login-japanese.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("invalid invitation retains selected language and offers a translated return link", async ({
  page,
}) => {
  await page.goto("/join?token=invalid");
  for (const locale of locales) {
    const t = dictionaries[locale];
    await page.getByLabel("Language", { exact: true }).selectOption(locale);
    await expect(
      page.getByRole("heading", { name: t.invalidInvitation, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: t.backToLogin, exact: true }),
    ).toHaveAttribute("href", "/");
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Einladungslink prüfen", exact: true }),
  ).toBeVisible();
});
