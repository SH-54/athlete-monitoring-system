import { test, expect } from "./demo-test";
import { dictionaries } from "../../lib/i18n";
import { locales, intlLocales } from "../../lib/locales";

test("seven languages switch report, entry, settings, import and chart labels", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: t.report })
      .click();
    await expect(
      page.getByRole("heading", { name: t.title, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".report-table tbody tr")).toHaveCount(20);
    await page.getByRole("button", { name: t.bulkImport, exact: true }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: t.importBulkProxyEntry }),
    ).toBeVisible();
    await expect(
      page.getByLabel(t.importImportType, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: t.close, exact: true })
      .click();
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: t.input, exact: true })
      .click();
    await expect(page.getByLabel(t.bodyPart, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "RPE", exact: true }).click();
    await expect(page.locator(".session-choice")).toHaveCount(3);
    await expect(
      page.getByLabel(t.actualMinutes, { exact: true }),
    ).toBeVisible();
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: t.settings, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: t.inviteTitle, exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(t.sleepRedMin, { exact: true })).toBeVisible();
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: t.overview, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: t.loadTrend, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".recharts-surface").first()).toBeVisible();
    await expect(page.getByTestId("flags-summary")).toContainText(t.redFlag);
    await expect(page.getByTestId("flags-summary")).toContainText(t.yellowFlag);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(language).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("language persists through reload and navigation to another role", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Informe diario del equipo",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await context.cookies()).find((cookie) => cookie.name === "athlos-locale")
      ?.value,
  ).toBe("es");
  const response = await page.request.get("/");
  expect(await response.text()).toContain('lang="es-ES"');
  await page.goto("/demo?role=coach");
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("es");
  await page.getByLabel("Language", { exact: true }).selectOption("pt");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Relatório diário da equipa",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("es");
});

test("language switching remains usable when browser preference storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Language", { exact: true }).selectOption("de");
  await expect(
    page.getByRole("heading", { name: "Täglicher Teambericht", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("de");
});
