import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alerts,
  flagLevel,
  loadFlag,
  thresholdErrors,
  isoDate,
} from "../lib/analytics";
import { makeDemo, defaultSettings } from "../lib/demo";
function fixture() {
  const d = makeDemo();
  const a = d.athletes[0],
    date = isoDate(new Date());
  d.pain = [];
  d.wellness = d.wellness.filter(
    (w) => w.athlete_id === a.id && w.date === date,
  );
  d.wellness[0] = { ...d.wellness[0], sleep_hours: 8, fatigue: 2 };
  d.sessions = d.sessions.filter(
    (s) => s.date === date && s.athlete_ids.includes(a.id),
  );
  d.entries = d.entries
    .filter(
      (e) =>
        e.athlete_id === a.id && d.sessions.some((s) => s.id === e.session_id),
    )
    .map((e) => ({ ...e, rpe: 1, status: "attended" }));
  return { d, a, date, w: d.wellness[0] };
}
test("sleep flags report the threshold for each severity and boundary", () => {
  const { d, a, date, w } = fixture();
  w.sleep_hours = 6;
  assert.equal(flagLevel(d, a, date), "yellow");
  assert.ok(
    alerts(d, a, date).some(
      (x) => x.value === "6h < 7h" && x.level === "warning",
    ),
  );
  w.sleep_hours = 4;
  assert.equal(flagLevel(d, a, date), "red");
  assert.ok(
    alerts(d, a, date).some(
      (x) => x.value === "4h < 5h" && x.level === "danger",
    ),
  );
  w.sleep_hours = 7;
  assert.equal(flagLevel(d, a, date), "normal");
});
test("pain and fatigue use distinct red/yellow settings with reversed fatigue direction", () => {
  const { d, a, date, w } = fixture();
  d.pain = [{ athlete_id: a.id, date, body_part: "knee", severity: 3 }];
  assert.equal(flagLevel(d, a, date), "yellow");
  d.pain[0].severity = 5;
  assert.equal(flagLevel(d, a, date), "red");
  d.pain = [];
  w.fatigue = 4;
  assert.equal(flagLevel(d, a, date), "yellow");
  w.fatigue = 5;
  assert.equal(flagLevel(d, a, date), "red");
  d.settings.scales.fatigue.direction = "higher_better";
  d.settings.fatigueMax = 2;
  d.settings.fatigueRed = 1;
  w.fatigue = 2;
  assert.equal(flagLevel(d, a, date), "yellow");
  w.fatigue = 1;
  assert.equal(flagLevel(d, a, date), "red");
});
test("missing records are grey; known danger remains red even with an incomplete load", () => {
  const { d, a, date } = fixture();
  d.entries[0].status = "pending";
  assert.equal(flagLevel(d, a, date), "missing");
  d.pain = [{ athlete_id: a.id, date, body_part: "knee", severity: 6 }];
  assert.equal(flagLevel(d, a, date), "red");
  assert.equal(loadFlag(null, d.settings), "missing");
  assert.equal(loadFlag(0, d.settings), "normal");
  assert.equal(loadFlag(750, d.settings), "normal");
  assert.equal(loadFlag(751, d.settings), "yellow");
  assert.equal(loadFlag(1000, d.settings), "red");
});
test("threshold ordering is validated and defaults remain valid", () => {
  const s = structuredClone(defaultSettings);
  assert.deepEqual(thresholdErrors(s), []);
  s.sleepRedMin = 8;
  s.painRedMin = 2;
  s.loadRedMax = 500;
  s.fatigueRed = 3;
  assert.equal(thresholdErrors(s).length, 4);
  s.scales.fatigue.direction = "higher_better";
  s.fatigueMax = 2;
  s.fatigueRed = 1;
  s.sleepRedMin = 5;
  s.painRedMin = 5;
  s.loadRedMax = 1000;
  assert.deepEqual(thresholdErrors(s), []);
});
test("demo current day contains three independent, team-correct sessions and all flag examples", () => {
  const d = makeDemo(),
    date = isoDate(new Date());
  for (const a of d.athletes) {
    const ss = d.sessions.filter(
      (s) => s.date === date && s.athlete_ids.includes(a.id),
    );
    assert.equal(ss.length, 3);
    assert.ok(ss.every((s) => s.team_id === a.team_id));
    assert.equal(new Set(ss.map((s) => s.id)).size, 3);
  }
  const levels = d.athletes.map((a) => flagLevel(d, a, date));
  assert.ok(levels.includes("red"));
  assert.ok(levels.includes("yellow"));
  assert.ok(levels.includes("missing"));
});
