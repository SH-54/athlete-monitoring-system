import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { makeDemo } from "../lib/demo";
import { createWorkbook } from "../lib/export";
import {
  parseDelimited,
  parseWorkbook,
  previewImport,
  bulkPayloadSchema,
} from "../lib/import";
const fixture = () => {
  const d = makeDemo();
  const a = d.athletes[0];
  const s = d.sessions.filter((s) => s.athlete_ids.includes(a.id)).at(-1)!;
  return { d, a, s };
};
test("CSV supports BOM, RFC quotes and multiline comments; TSV accepts Japanese headers", () => {
  const rows = parseDelimited(
    '\uFEFFdate,team,athlete_number,comment\r\n2026-11-03,First,1,"line one\nline two, ""quoted"""',
  );
  assert.equal(rows[0].values.comment, 'line one\nline two, "quoted"');
  const tsv = parseDelimited(
    "日付\tチーム\t背番号\tRPE\t参加時間\n2026-11-03\tFirst\t1\t4\t70",
  );
  assert.equal(tsv[0].values.athlete_number, "1");
  assert.equal(tsv[0].values.minutes, "70");
  assert.equal(tsv[0].values.rpe, "4");
});
test("parser rejects malformed headers, quoting, oversized inputs and duplicate aliases", () => {
  assert.throws(
    () => parseDelimited("date,日付\n2026-11-03,2026-11-03"),
    /Duplicate/,
  );
  assert.throws(() => parseDelimited("unknown\nx"), /Unknown/);
  assert.throws(() => parseDelimited('comment\n"unclosed'), /Unclosed/);
  assert.throws(
    () => parseDelimited("comment\n" + "x".repeat(2 * 1024 * 1024)),
    /2 MB/,
  );
  assert.throws(
    () => parseDelimited("date\n" + Array(501).fill("2026-11-03").join("\n")),
    /500/,
  );
});
test("standard XLSX round trips numeric and Unicode inline strings", () => {
  const rows = [
    {
      athlete_id: "demo",
      team_id: "first",
      date: "2026-11-03",
      rpe: 4,
      minutes: 70,
      comment: "中文 <tag> 日本語",
    },
  ];
  const parsed = parseWorkbook(createWorkbook(rows));
  assert.equal(parsed[0].values.rpe, "4");
  assert.equal(parsed[0].values.comment, "中文 <tag> 日本語");
});
function workbookWithSheet(
  sheet: string,
  extra: Record<string, Uint8Array> = {},
) {
  return zipSync({
    "xl/workbook.xml": strToU8(
      '<workbook><sheets><sheet name="Data" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
    ...extra,
  });
}
test("XLSX handles shared strings and rejects formulas, macros, entities and zip bombs", () => {
  const sheet =
    '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row></sheetData></worksheet>';
  const parsed = parseWorkbook(
    workbookWithSheet(sheet, {
      "xl/sharedStrings.xml": strToU8(
        "<sst><si><t>date</t></si><si><t>2026-11-03</t></si></sst>",
      ),
    }),
  );
  assert.equal(parsed[0].values.date, "2026-11-03");
  assert.throws(
    () =>
      parseWorkbook(
        workbookWithSheet(sheet.replace("<v>0</v>", "<f>1+1</f><v>2</v>")),
      ),
    /Formula/,
  );
  assert.throws(
    () =>
      parseWorkbook(
        workbookWithSheet(sheet, { "xl/vbaProject.bin": new Uint8Array([1]) }),
      ),
    /Macros/,
  );
  assert.throws(
    () =>
      parseWorkbook(
        workbookWithSheet(
          '<!DOCTYPE x [<!ENTITY y SYSTEM "file:///secret">]>' + sheet,
        ),
      ),
    /entities/,
  );
  assert.throws(
    () =>
      parseWorkbook(
        workbookWithSheet(sheet, {
          "xl/sharedStrings.xml": strToU8("a".repeat(5 * 1024 * 1024)),
        }),
      ),
    /limit/,
  );
});
test("three daily sessions remain three independent rows; default minutes uses each assigned session", () => {
  const { d, a, s } = fixture();
  const sessions = [70, 50, 30].map((duration, i) => ({
    ...s,
    id: `import-session-${i}`,
    code: `IMPORT-${i}`,
    duration,
  }));
  d.sessions = [...d.sessions.filter((x) => x.date !== s.date), ...sessions];
  const text =
    "athlete_id,team_id,date,session_code,rpe\n" +
    sessions
      .map((x, i) => [a.id, x.team_id, x.date, x.code, [4, 7, 5][i]].join(","))
      .join("\n");
  const preview = previewImport(
    parseDelimited(text),
    "rpe",
    d,
    "administrator",
  );
  assert.deepEqual(preview.errors, []);
  assert.equal(preview.items.length, 3);
  assert.equal(
    new Set(
      preview.items.map((x) =>
        "session_id" in x.value ? x.value.session_id : "",
      ),
    ).size,
    3,
  );
  assert.equal((preview.items[2].value as { minutes: number }).minutes, 30);
});
test("preview rejects duplicates, unknown dates, unassigned athletes and invalid RPE", () => {
  const { d, a, s } = fixture();
  const header = "athlete_id,team_id,date,session_code,rpe";
  const row = [a.id, s.team_id, s.date, s.code, 4].join(",");
  const duplicate = previewImport(
    parseDelimited(header + "\n" + row + "\n" + row),
    "rpe",
    d,
    "administrator",
  );
  assert.equal(duplicate.errors.length, 1);
  assert.match(duplicate.errors[0].message, /Duplicate/);
  for (const values of [
    [a.id, s.team_id, "2026-02-30", s.code, 4],
    [a.id, s.team_id, s.date, "UNKNOWN", 4],
    [a.id, s.team_id, s.date, s.code, 11],
  ]) {
    assert.equal(
      previewImport(
        parseDelimited(header + "\n" + values.join(",")),
        "rpe",
        d,
        "administrator",
      ).errors.length,
      1,
    );
  }
  d.sessions.find((x) => x.id === s.id)!.athlete_ids = [];
  assert.match(
    previewImport(
      parseDelimited(header + "\n" + row),
      "rpe",
      d,
      "administrator",
    ).errors[0].message,
    /assigned/,
  );
});
test("athlete matching rejects ambiguous jersey numbers and preserves submitted detection", () => {
  const { d, a, s } = fixture();
  const text = `athlete_number,team_id,date,session_code,rpe\n${a.number},${s.team_id},${s.date},${s.code},0`;
  const result = previewImport(parseDelimited(text), "rpe", d, "coach");
  assert.equal(result.errors.length, 0);
  assert.equal(result.items[0].existing, true);
  assert.equal((result.items[0].value as { rpe: number }).rpe, 0);
  d.athletes.push({ ...a, id: "duplicate" });
  assert.match(
    previewImport(parseDelimited(text), "rpe", d, "coach").errors[0].message,
    /ambiguous/,
  );
});
test("wellness imports support coaching staff and configured scales", () => {
  const { d, a, s } = fixture();
  const text = `athlete_id,team_id,date,sleep_hours,sleep_quality,fatigue,soreness,stress,appetite,weight,comment\n${a.id},${s.team_id},${s.date},8,3,2,2,2,3,70,OK`;
  assert.equal(
    previewImport(parseDelimited(text), "wellness", d, "coach").errors.length,
    0,
  );
  assert.equal(
    previewImport(parseDelimited(text), "rpe", d, "athlete").errors.length,
    1,
  );
  assert.equal(
    previewImport(parseDelimited(text), "wellness", d, "administrator").errors
      .length,
    0,
  );
  d.settings.scales.fatigue.min = 3;
  assert.match(
    previewImport(parseDelimited(text), "wellness", d, "administrator")
      .errors[0].message,
    /fatigue/,
  );
});
test("non-participation rejects RPE/minutes and server schema disallows invalid normalized batches", () => {
  const { d, a, s } = fixture();
  const header = "athlete_id,team_id,date,session_code,status,minutes,rpe";
  assert.equal(
    previewImport(
      parseDelimited(
        `${header}\n${a.id},${s.team_id},${s.date},${s.code},rest,0,`,
      ),
      "rpe",
      d,
      "administrator",
    ).errors.length,
    0,
  );
  assert.equal(
    previewImport(
      parseDelimited(
        `${header}\n${a.id},${s.team_id},${s.date},${s.code},rest,10,2`,
      ),
      "rpe",
      d,
      "administrator",
    ).errors.length,
    1,
  );
  assert.equal(
    bulkPayloadSchema.safeParse({ kind: "rpe", overwrite: false, rows: [] })
      .success,
    false,
  );
  assert.equal(
    bulkPayloadSchema.safeParse({
      kind: "rpe",
      overwrite: false,
      rows: [{ athlete_id: "forged" }],
    }).success,
    false,
  );
});
