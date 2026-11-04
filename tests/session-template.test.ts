import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDemo } from "../lib/demo";
import { isoDate } from "../lib/analytics";
import {
  sessionTemplateRows,
  sessionTemplateFile,
} from "../lib/session-template";
import { parseDelimited, parseWorkbook, previewImport } from "../lib/import";
function fixture() {
  const data = makeDemo(),
    date = isoDate(new Date());
  const sessions = data.sessions.filter(
    (s) => s.date === date && s.team_id === "first",
  );
  const s = sessions[0];
  data.entries
    .filter((e) => e.session_id === s.id)
    .forEach((e) => {
      e.status = "pending";
      e.rpe = null;
    });
  return { data, s, sessions };
}
test("one-session CSV contains full assigned roster with readable names and blank RPE", () => {
  const { data, s } = fixture(),
    rows = sessionTemplateRows(data, s.id);
  assert.equal(rows.length, s.athlete_ids.length);
  assert.ok(
    rows.every(
      (r) =>
        r.session_id === s.id &&
        r.date === s.date &&
        r.rpe === "" &&
        r.minutes === s.duration,
    ),
  );
  assert.equal(rows[0].athlete_name, data.athletes[0].name);
  assert.ok(!rows.some((r) => r.team_id === "u21"));
  assert.throws(() => sessionTemplateRows(data, "not-a-session"));
});
test("blank pending rows are left unsubmitted; filled RPE and zero are imported", () => {
  const { data, s } = fixture();
  const rows = parseDelimited(sessionTemplateFile(data, s.id, "csv") as string);
  rows[0].values.rpe = "4";
  rows[1].values.rpe = "0";
  const preview = previewImport(rows, "rpe", data, "coach", s.id);
  assert.equal(preview.errors.length, 0);
  assert.equal(preview.items.length, 2);
  assert.equal(preview.skippedRows?.length, s.athlete_ids.length - 2);
  assert.equal((preview.items[1].value as { rpe: number }).rpe, 0);
  assert.ok(preview.items.every((r) => r.session === s.code));
});
test("Excel input sheet roundtrips and refuses another session in a selected-session import", () => {
  const { data, s, sessions } = fixture();
  const rows = parseWorkbook(
    new Uint8Array(sessionTemplateFile(data, s.id, "xlsx") as ArrayBuffer),
  );
  assert.equal(rows.length, s.athlete_ids.length);
  rows[0].values.rpe = "5";
  assert.equal(
    previewImport(rows, "rpe", data, "coach", sessions[1].id).errors.length,
    s.athlete_ids.length,
  );
  assert.equal(previewImport(rows, "rpe", data, "coach", s.id).items.length, 1);
});
test("submitted records and actual minutes are retained in exports; duplicate pending and invalid minutes are errors", () => {
  const { data, s } = fixture();
  const entry = data.entries.find((e) => e.session_id === s.id)!;
  entry.status = "attended";
  entry.rpe = 7;
  entry.minutes = 42;
  const rows = sessionTemplateRows(data, s.id);
  assert.equal(rows[0].minutes, 42);
  assert.equal(rows[0].rpe, 7);
  const parsed = parseDelimited(
    sessionTemplateFile(data, s.id, "csv") as string,
  );
  const preview = previewImport(parsed, "rpe", data, "coach", s.id);
  assert.equal(preview.items[0].existing, true);
  const empty = parsed[1];
  assert.equal(
    previewImport([empty, empty], "rpe", data, "coach", s.id).errors.length,
    1,
  );
  empty.values.minutes = "-2";
  assert.equal(
    previewImport([empty], "rpe", data, "coach", s.id).errors.length,
    1,
  );
});
test("CSV names are protected from spreadsheet formula execution", () => {
  const { data, s } = fixture();
  data.athletes[0].name = '=HYPERLINK("bad")';
  const rows = parseDelimited(sessionTemplateFile(data, s.id, "csv") as string);
  assert.ok(rows[0].values.athlete_name.startsWith("'="));
  rows[0].values.rpe = "4";
  assert.equal(previewImport(rows, "rpe", data, "coach", s.id).items.length, 1);
});

test("CSV dates reformatted by Japanese/Chinese Excel still match the original session", () => {
  const { data, s } = fixture();
  const rows = parseDelimited(sessionTemplateFile(data, s.id, "csv") as string);
  const [y, m, d] = s.date.split("-");
  rows[0].values.date = `${y}/${Number(m)}/${Number(d)}`;
  rows[0].values.rpe = "4";
  const p = previewImport(rows, "rpe", data, "coach", s.id);
  assert.equal(p.errors.length, 0);
  assert.equal(p.items[0].date, s.date);
  rows[0].values.date = "2026/2/30";
  assert.equal(
    previewImport(rows, "rpe", data, "coach", s.id).errors.length,
    1,
  );
});
