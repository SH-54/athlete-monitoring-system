import { test, expect } from "./demo-test";
test("daily report filters, sessions, athlete profile, language and export", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "每日球队报告", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".report-table tbody tr")).toHaveCount(20);
  await page.getByPlaceholder("搜索球员姓名或号码…").fill("李明远");
  await expect(page.locator(".report-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "按训练查看", exact: true }).click();
  await expect(page.locator(".report-table tbody tr")).toHaveCount(3);
  await page.locator(".athlete-cell").first().click();
  await expect(
    page.getByRole("heading", { name: "李明远", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("ACWR · 耦合", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回报告" }).click();
  await page.getByRole("button", { name: "导出报告" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toContain(".csv");
  await page.getByRole("button", { name: "导出报告" }).click();
  const excelDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "XLSX", exact: true }).click();
  const excel = await excelDownload;
  expect(excel.suggestedFilename()).toContain(".xlsx");
  await excel.saveAs("/tmp/athlos-report.xlsx");
  const pdf = await page.pdf({
    path: "/tmp/athlos-report.pdf",
    format: "A3",
    landscape: true,
  });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  await page.getByLabel("Language").selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Daily team report", exact: true }),
  ).toBeVisible();
});
test("wellness and RPE submissions change the report; session creation works", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "每日填报" })
    .click();
  await page.getByLabel("睡眠时长").fill("6");
  await page.getByLabel("身体部位").fill("左膝");
  await page.getByLabel("疼痛程度 (0–10)").fill("5");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("记录已保存");
  await page.getByRole("button", { name: "RPE", exact: true }).click();
  await page.getByRole("button", { name: "7", exact: true }).click();
  await page.getByLabel("实际参与时间（分钟）").fill("60");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "每日球队报告" })
    .click();
  await page.getByPlaceholder("搜索球员姓名或号码…").fill("陈宇航");
  await expect(page.locator(".report-table tbody")).toContainText("6");
  await expect(page.locator(".report-table tbody")).toContainText("左膝");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "训练计划" })
    .click();
  const beforeSessions = await page.locator(".session-card").count();
  await page.getByRole("button", { name: "新建训练", exact: true }).click();
  await page.getByLabel("训练编号").fill("TR-DEMO");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "新建训练", exact: true })
    .click();
  await expect(page.locator(".session-card")).toHaveCount(beforeSessions + 1);
  await expect(page.getByText("TR-DEMO", { exact: true })).toBeVisible();
  await page
    .locator(".session-card")
    .filter({ hasText: "TR-DEMO" })
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await page.getByLabel("训练编号").fill("TR-EDITED");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存记录", exact: true })
    .click();
  await expect(page.getByText("TR-EDITED", { exact: true })).toBeVisible();
});
test("dashboard charts render and mobile report remains usable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "总览", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "训练负荷趋势" }),
  ).toBeVisible();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "菜单", exact: true }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "每日球队报告" })
    .click();
  await expect(
    page.getByRole("heading", { name: "每日球队报告", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect
    .poll(async () =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await page.screenshot({ path: "/tmp/athlos-mobile.png", fullPage: true });
});

test("settings and management update demo data", async ({ page }) => {
  await page.goto("/");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "设置", exact: true })
    .click();
  await page.getByLabel("睡眠下限（小时）").fill("8");
  await page
    .locator(".settings-layout")
    .getByRole("button", { name: "保存记录", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("设置已保存");
  await page.getByLabel("新球队名称").fill("Academy Demo");
  await page.getByRole("button", { name: "添加球队", exact: true }).click();
  await expect(page.locator(".managed-teams")).toContainText(["Academy Demo"]);
});
