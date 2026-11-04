import { normalizeSettings } from "../lib/settings";
import { thresholdErrors } from "../lib/analytics";
import { createWorkbook } from "../lib/export";
import { unzipSync, strFromU8 } from "fflate";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isoDate,
  dailyLoad,
  loadMetrics,
  rolling,
  ewma,
  alerts,
  periodLoad,
  shiftDate,
} from "../lib/analytics";
import { makeDemo } from "../lib/demo";
import { rpeSchema, wellnessSchema, sessionSchema } from "../lib/validation";
test("multiple sessions sum to 780 AU and respond to edits", () => {
  const d = makeDemo();
  const id = d.athletes[0].id,
    date = "2026-11-03";
  d.sessions = [70, 50, 30].map((duration, i) => ({
    id: `s${i}`,
    code: `TR${i}`,
    date,
    duration,
    type: "Field",
    start_time: "09:00",
    end_time: "10:10",
    team_id: "first",
    athlete_ids: [id],
  }));
  d.entries = [4, 7, 5].map((rpe, i) => ({
    athlete_id: id,
    session_id: `s${i}`,
    status: "attended",
    minutes: [70, 50, 30][i],
    rpe,
  }));
  assert.equal(dailyLoad(d, id, date), 780);
  d.entries[1].minutes = 40;
  assert.equal(dailyLoad(d, id, date), 710);
  assert.equal(periodLoad(d, id, date, date).total, 710);
});
test("missing, pending, rest and absence are distinct", () => {
  const d = makeDemo(),
    a = d.athletes[0];
  const date = d.sessions.at(-1)!.date;
  d.entries
    .filter((e) => e.athlete_id === a.id)
    .forEach((e) => {
      e.status = "rest";
      e.rpe = null;
    });
  assert.equal(dailyLoad(d, a.id, date), 0);
  const e = d.entries.find(
    (e) =>
      e.athlete_id === a.id &&
      d.sessions.some((s) => s.id === e.session_id && s.date === date),
  )!;
  e.status = "pending";
  assert.equal(dailyLoad(d, a.id, date), null);
  assert.equal(dailyLoad(d, a.id, "1900-01-01"), null);
  e.status = "absent";
  assert.equal(dailyLoad(d, a.id, date), 0);
});
test("rolling uses calendar windows, rejects missing or insufficient history", () => {
  assert.equal(rolling([1, 2, 3], 7), null);
  assert.equal(rolling([1, 2, null], 3), null);
  assert.equal(rolling([0, 0, 0], 3), 0);
  assert.equal(rolling([9, 1, 2, 3], 3), 6);
  assert.equal(shiftDate("2024-03-01", -1), "2024-02-29");
});
test("ACWR coupled and uncoupled use documented windows", () => {
  const v = [...Array(28).fill(100), ...Array(7).fill(200)];
  assert.equal(loadMetrics(v, "uncoupled").acwr, 2);
  assert.equal(loadMetrics(v, "coupled").acwr, 1.6);
  assert.equal(loadMetrics(Array(28).fill(0)).acwr, null);
  assert.equal(loadMetrics(Array(7).fill(100)).monotony, null);
  assert.equal(loadMetrics([100, 100, null, 100, 100, 100, 100]).strain, null);
  assert.equal(loadMetrics(Array(27).fill(100)).chronic, null);
  assert.equal(ewma(Array(28).fill(100), 28), 100);
});
test("monotony and strain include zero-load days", () => {
  const m = loadMetrics([0, 100, 200, 300, 400, 500, 600]);
  assert.equal(m.monotony, 1.5);
  assert.equal(m.strain, 3150);
});
test("alerts expose measured value and configurable threshold", () => {
  const d = makeDemo(),
    a = d.athletes[2],
    date = d.sessions.at(-1)!.date;
  const aa = alerts(d, a, date);
  assert.ok(
    aa.some((x) => x.kind === "sleep" && x.value.includes("5.5h < 7h")),
  );
  d.settings.sleepMin = 5;
  assert.ok(!alerts(d, a, date).some((x) => x.kind === "sleep"));
  d.settings.scales.fatigue.direction = "higher_better";
  d.settings.fatigueMax = 2;
  assert.ok(!alerts(d, a, date).some((x) => x.kind === "fatigue"));
});
test("server validation rejects out-of-range RPE, missing RPE, and malformed sessions", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const v = {
    athlete_id: id,
    session_id: id,
    status: "attended",
    minutes: 70,
    rpe: 11,
  };
  assert.equal(rpeSchema.safeParse(v).success, false);
  assert.equal(rpeSchema.safeParse({ ...v, rpe: null }).success, false);
  assert.equal(rpeSchema.safeParse({ ...v, rpe: 0 }).success, true);
  assert.equal(
    rpeSchema.safeParse({ ...v, status: "rest", rpe: null }).success,
    true,
  );
  assert.equal(wellnessSchema.safeParse({}).success, false);
  assert.equal(
    sessionSchema.safeParse({
      code: "TR001",
      date: "2026-11-03",
      team_id: id,
      type: "Field",
      start_time: "12:00",
      end_time: "11:00",
      duration: 70,
      athlete_ids: [id],
    }).success,
    false,
  );
});

test("reporting day respects Shanghai midnight", () => {
  assert.equal(isoDate(new Date("2026-11-02T16:30:00Z")), "2026-11-03");
});

test("XLSX is a structured workbook and untrusted text cannot become formulas or XML", () => {
  const zip = unzipSync(
    createWorkbook([{ name: '=HYPERLINK("bad") <tag>&', load: 780 }]),
  );
  assert.ok(zip["[Content_Types].xml"]);
  assert.ok(zip["xl/workbook.xml"]);
  const sheet = strFromU8(zip["xl/worksheets/sheet1.xml"]);
  assert.ok(sheet.includes("&lt;tag&gt;&amp;"));
  assert.ok(sheet.includes("<v>780</v>"));
  assert.ok(sheet.includes('t="inlineStr"'));
  assert.ok(!sheet.includes("<f>"));
});

test("session input rejects invalid clock time before hitting database", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const base = {
    code: "TR-BAD",
    date: "2026-11-03",
    team_id: id,
    type: "Field",
    duration: 70,
    athlete_ids: [id],
  };
  assert.equal(
    sessionSchema.safeParse({ ...base, start_time: "24:00", end_time: "25:00" })
      .success,
    false,
  );
  assert.equal(
    sessionSchema.safeParse({ ...base, start_time: "09:60", end_time: "11:00" })
      .success,
    false,
  );
});

test("legacy configured thresholds receive compatible red defaults", () => {
  const settings = normalizeSettings({
    sleepMin: 4,
    painMin: 8,
    loadMax: 2000,
  });
  assert.deepEqual(thresholdErrors(settings), []);
  assert.equal(settings.sleepRedMin, 4);
  assert.equal(settings.painRedMin, 8);
  assert.equal(settings.loadRedMax, 2250);
  const reversed = normalizeSettings({
    scales: {
      ...settings.scales,
      fatigue: { min: 0, max: 10, direction: "higher_better" },
    },
  });
  assert.equal(reversed.fatigueRed, 0);
  assert.deepEqual(thresholdErrors(reversed), []);
});
