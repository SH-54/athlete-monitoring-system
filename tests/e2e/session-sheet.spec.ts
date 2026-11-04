import { test, expect } from "./demo-test";
import fs from "node:fs/promises";
import { parseDelimited } from "../../lib/import";
test("coach exports this session roster as CSV, fills one RPE, and imports it without touching other sessions", async ({
  page,
}) => {
  await page.goto("/demo?role=coach");
  await page.getByLabel("Language").selectOption("ja");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "トレーニング予定", exact: true })
    .click();
  const card = page.locator(".session-card").first();
  const download = page.waitForEvent("download");
  await card.getByRole("button", { name: "CSV 入力表", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain("-input.csv");
  const path = await file.path();
  expect(path).toBeTruthy();
  const rows = parseDelimited(await fs.readFile(path!, "utf8"));
  expect(rows).toHaveLength(16);
  expect(new Set(rows.map((r) => r.values.session_id)).size).toBe(1);
  const row = rows.find((r) => r.values.athlete_id === "demo-6")!;
  expect(row.values.rpe).toBe("");
  row.values.rpe = "9";
  const keys = Object.keys(rows[0].values),
    quote = (v: string) => '"' + v.replaceAll('"', '""') + '"';
  const csv = [
    keys.map(quote).join(","),
    ...rows.map((r) => keys.map((k) => quote(r.values[k])).join(",")),
  ].join("\r\n");
  await card
    .getByRole("button", { name: "この練習を取り込む", exact: true })
    .click();
  await expect(page.getByLabel("入力表のセッション")).toBeDisabled();
  await page.getByLabel("取り込みファイル").setInputFiles({
    name: "filled-session.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.locator(".import-errors")).toHaveCount(0);
  await expect(page.getByText(/行はRPE未記入のため/)).toBeVisible();
  await page
    .getByRole("button", { name: "確認して取り込みを保存", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("保存 1 件");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "日別チームレポート" })
    .click();
  await page.getByPlaceholder("選手名・背番号で検索…").fill("赵梓豪");
  await page.getByRole("button", { name: "セッション別", exact: true }).click();
  const report = page.locator(".report-table tbody tr");
  await expect(report).toHaveCount(3);
  await expect(report.first()).toContainText("630");
  await expect(report.first().locator("td").nth(2)).toContainText("提出済");
  await expect(report.nth(1).locator("td").nth(2)).toContainText("未提出");
});
