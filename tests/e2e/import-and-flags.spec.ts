import { test, expect } from "./demo-test";
import { makeDemo } from "../../lib/demo";
import { isoDate } from "../../lib/analytics";
import { createWorkbook } from "../../lib/export";
const fixture = () => {
  const data = makeDemo(),
    date = isoDate(new Date()),
    athlete = data.athletes[0],
    sessions = data.sessions
      .filter((s) => s.date === date && s.athlete_ids.includes(athlete.id))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  return { data, date, athlete, sessions };
};
async function openImport(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "批量导入", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "批量代理填报" }),
  ).toBeVisible();
}
test("XLSX proxy import saves three independent sessions as 780 AU, preserving existing by default", async ({
  page,
}) => {
  const { date, athlete, sessions } = fixture();
  expect(sessions.length).toBe(3);
  await page.goto("/");
  await openImport(page);
  const rows = sessions.map((s, i) => ({
    athlete_id: athlete.id,
    team_id: s.team_id,
    date,
    session_id: s.id,
    status: "attended",
    minutes: [70, 50, 30][i],
    rpe: [4, 7, 5][i],
  }));
  await page.getByLabel("导入文件").setInputFiles({
    name: "three-sessions.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(createWorkbook(rows)),
  });
  await expect(page.locator(".import-preview tbody tr")).toHaveCount(3);
  const save = page.getByRole("button", {
    name: "确认并保存导入",
    exact: true,
  });
  await expect(save).toBeDisabled();
  await page.locator(".import-overwrite input").check();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole("status")).toContainText("已保存 3 条");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "关闭", exact: true })
    .click();
  await page.getByPlaceholder("搜索球员姓名或号码…").fill(athlete.name);
  await expect(page.locator(".report-table tbody")).toContainText("780");
  await page.getByRole("button", { name: "按训练查看", exact: true }).click();
  await expect(page.locator(".report-table tbody tr")).toHaveCount(3);
  for (const load of ["280", "350", "150"])
    await expect(page.locator(".report-table tbody")).toContainText(load);
});
test("spreadsheet paste rejects duplicate and unknown-session rows without saving", async ({
  page,
}) => {
  const { date, athlete, sessions } = fixture();
  await page.goto("/");
  await openImport(page);
  const s = sessions[0];
  const head = "athlete_id\tteam_id\tdate\tsession_id\tminutes\trpe";
  const row = `${athlete.id}\t${s.team_id}\t${date}\t${s.id}\t70\t4`;
  await page.getByLabel("粘贴表格").fill([head, row, row].join("\n"));
  await page.getByRole("button", { name: "预览粘贴数据", exact: true }).click();
  await expect(page.locator(".import-errors")).toContainText("重复");
  await expect(
    page.getByRole("button", { name: "确认并保存导入", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("粘贴表格")
    .fill([head, row.replace(s.id, "UNKNOWN")].join("\n"));
  await page.getByRole("button", { name: "预览粘贴数据", exact: true }).click();
  await expect(page.locator(".import-errors")).toContainText("训练");
  await expect(
    page.getByRole("button", { name: "确认并保存导入", exact: true }),
  ).toBeDisabled();
});
test("session drafts remain isolated across all three sessions and athletes", async ({
  page,
}) => {
  const { sessions } = fixture();
  await page.goto("/");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "每日填报", exact: true })
    .click();
  await page.getByRole("button", { name: "RPE", exact: true }).click();
  await expect(page.locator(".session-choice")).toHaveCount(3);
  await page.getByLabel("实际参与时间（分钟）").fill("17");
  await page.getByRole("button", { name: "9", exact: true }).click();
  await page.getByLabel("选择训练").selectOption(sessions[1].id);
  await expect(page.getByLabel("实际参与时间（分钟）")).not.toHaveValue("17");
  await page.getByLabel("实际参与时间（分钟）").fill("23");
  await page.getByLabel("选择训练").selectOption(sessions[2].id);
  await page.getByLabel("实际参与时间（分钟）").fill("31");
  await page.getByLabel("选择训练").selectOption(sessions[0].id);
  await expect(page.getByLabel("实际参与时间（分钟）")).toHaveValue("17");
  await expect(page.locator(".rpe-buttons button.selected")).toHaveText("9");
  await page
    .getByRole("combobox", { name: "状态", exact: true })
    .selectOption("absent");
  await page
    .getByRole("combobox", { name: "球员", exact: true })
    .selectOption("demo-2");
  await expect(
    page.getByRole("combobox", { name: "状态", exact: true }),
  ).toHaveValue("attended");
});
test("red/yellow thresholds are visible in reports and individual graphs without console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "状态", exact: true })
    .selectOption("red");
  await expect(page.locator(".report-table tbody tr")).not.toHaveCount(0);
  await expect(page.locator(".report-table tbody")).toContainText("红旗");
  await page
    .getByRole("combobox", { name: "状态", exact: true })
    .selectOption("yellow");
  await expect(page.locator(".report-table tbody tr")).not.toHaveCount(0);
  await expect(page.locator(".report-table tbody")).toContainText("黄旗");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "总览", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "球员", exact: true })
    .selectOption("demo-1");
  await expect(page.locator(".recharts-reference-line")).not.toHaveCount(0);
  await expect(page.getByTestId("load-threshold-legend")).toContainText(
    "750 AU",
  );
  await expect(page.getByTestId("load-threshold-legend")).toContainText(
    "1000 AU",
  );
  const lines = page.locator(".recharts-reference-line-line");
  await expect(lines.first()).toHaveAttribute("stroke", "#c28b25");
  expect(
    await lines
      .first()
      .evaluate(
        (el) =>
          Number(el.getAttribute("x2")) > Number(el.getAttribute("x1")) &&
          Number.isFinite(Number(el.getAttribute("y1"))),
      ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/athlos-flags.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("athlete-style entry saves all three sessions separately and preserves multiple pain sites", async ({
  page,
}) => {
  const { data, date } = fixture(),
    athlete = data.athletes[5];
  const sessions = data.sessions
    .filter((s) => s.date === date && s.athlete_ids.includes(athlete.id))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  await page.goto("/");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "每日填报", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "球员", exact: true })
    .selectOption(athlete.id);
  await page.getByRole("button", { name: "RPE", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByLabel("选择训练").selectOption(sessions[i].id);
    await page.getByLabel("实际参与时间（分钟）").fill(String([70, 50, 30][i]));
    await page
      .getByRole("button", { name: String([4, 7, 5][i]), exact: true })
      .click();
    await page.getByRole("button", { name: "保存记录", exact: true }).click();
    await expect(
      page.locator(`.session-choice[data-session-id="${sessions[i].id}"]`),
    ).toContainText("本训练已提交");
  }
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "每日球队报告" })
    .click();
  await page.getByPlaceholder("搜索球员姓名或号码…").fill(athlete.name);
  await expect(page.locator(".report-table tbody")).toContainText("780");
  await page.getByRole("button", { name: "按训练查看", exact: true }).click();
  for (const row of await page.locator(".report-table tbody tr").all())
    await expect(row.locator("td").nth(2)).toContainText("已提交");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "每日填报", exact: true })
    .click();
  await page.getByLabel("身体部位", { exact: true }).fill("左膝");
  await page.getByLabel("疼痛程度 (0–10)", { exact: true }).fill("3");
  await page.getByRole("button", { name: "添加疼痛部位", exact: true }).click();
  await page.getByLabel("身体部位 2", { exact: true }).fill("右踝");
  await page.getByLabel("疼痛程度 2 (0–10)", { exact: true }).fill("5");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await page.getByRole("button", { name: "RPE", exact: true }).click();
  await page.getByRole("button", { name: "晨间状态", exact: true }).click();
  await expect(page.getByLabel("身体部位 2", { exact: true })).toHaveValue(
    "右踝",
  );
  await page.getByLabel("睡眠时长").fill("7.2");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "每日球队报告" })
    .click();
  await page.getByPlaceholder("搜索球员姓名或号码…").fill("陈宇航");
  await expect(page.locator(".report-table tbody")).toContainText("左膝");
  await expect(page.locator(".report-table tbody")).toContainText("右踝");
});
