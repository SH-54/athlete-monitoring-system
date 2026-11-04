import { test, expect } from "./demo-test";
test("athlete sees only own assigned records and no staff tools", async ({
  page,
}) => {
  await page.goto("/demo?role=athlete");
  await page.getByLabel("Language").selectOption("ja");
  await expect(
    page
      .locator(".sidebar nav")
      .getByRole("button", { name: "毎日の入力", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "一括取り込み", exact: true }),
  ).toHaveCount(0);
  const athlete = page.getByRole("combobox", { name: "選手", exact: true });
  await expect(athlete.locator("option")).toHaveCount(1);
  await expect(
    page
      .locator(".sidebar nav")
      .getByRole("button", { name: "設定", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "RPE", exact: true }).click();
  await expect(page.locator(".session-choice")).toHaveCount(3);
  await page.getByLabel("実参加時間（分）").fill("60");
  await page.getByRole("button", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "記録を保存", exact: true }).click();
  await expect(page.locator(".session-choice.selected")).toContainText(
    "420 AU",
  );
});
test("coach can proxy morning wellness, pain and RPE for assigned team", async ({
  page,
}) => {
  await page.goto("/demo?role=coach");
  await page.getByLabel("Language").selectOption("ja");
  await expect(
    page
      .locator(".sidebar nav")
      .getByRole("button", { name: "医療記録", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "毎日の入力", exact: true })
    .click();
  const athlete = page.getByRole("combobox", { name: "選手", exact: true });
  await expect(athlete.locator("option")).toHaveCount(16);
  await page
    .getByRole("spinbutton", { name: "体重 kg", exact: true })
    .fill("77.7");
  await page.getByLabel("身体部位", { exact: true }).fill("代理入力・左膝");
  await page.getByLabel("痛みの程度 (0–10)", { exact: true }).fill("3");
  await page.getByRole("button", { name: "記録を保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("保存しました");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "日別チームレポート" })
    .click();
  await page.getByPlaceholder("選手名・背番号で検索…").fill("陈宇航");
  await expect(page.locator(".report-table tbody")).toContainText("77.7");
  await expect(page.locator(".report-table tbody")).toContainText(
    "代理入力・左膝",
  );
  await page.getByRole("button", { name: "一括取り込み", exact: true }).click();
  await expect(
    page.getByLabel("取り込み種別").locator('option[value="wellness"]'),
  ).toHaveCount(1);
});
