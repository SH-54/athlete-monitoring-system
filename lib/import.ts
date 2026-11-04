import { strFromU8, unzipSync } from "fflate";
import { z } from "zod";
import type { Dataset, Entry, Role, Wellness } from "./types";
export type ImportKind = "rpe" | "wellness";
export type ImportRow = { row: number; values: Record<string, string> };
export type ImportIssue = { row: number; message: string };
export type ImportedRpe = Entry & { date: string; team_id: string };
export type ImportedWellness = Wellness;
export type PreviewItem = {
  row: number;
  athlete: string;
  session: string;
  date: string;
  existing: boolean;
  value: ImportedRpe | ImportedWellness;
};
export type ImportPreview = {
  items: PreviewItem[];
  errors: ImportIssue[];
  skippedRows?: ImportIssue[];
};
export const IMPORT_LIMIT = 500;
export const importRpeSchema = z
  .object({
    athlete_id: z.uuid(),
    session_id: z.uuid(),
    date: z.iso.date(),
    team_id: z.uuid(),
    status: z.enum([
      "attended",
      "rehabilitation",
      "rest",
      "absent",
      "not_participating",
    ]),
    minutes: z.number().int().min(0).max(600),
    rpe: z.number().min(0).max(10).nullable(),
  })
  .refine(
    (v) =>
      ["attended", "rehabilitation"].includes(v.status)
        ? v.rpe !== null
        : v.rpe === null && v.minutes === 0,
    {
      message:
        "Participation requires RPE; non-participation requires minutes=0 and no RPE",
    },
  );
export const importWellnessSchema = z.object({
  athlete_id: z.uuid(),
  date: z.iso.date(),
  sleep_hours: z.number().min(0).max(24),
  sleep_quality: z.number().int().min(0).max(10),
  fatigue: z.number().int().min(0).max(10),
  soreness: z.number().int().min(0).max(10),
  stress: z.number().int().min(0).max(10),
  appetite: z.number().int().min(0).max(10),
  weight: z.number().min(20).max(300),
  comment: z.string().max(2000),
});
export const bulkPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rpe"),
    overwrite: z.boolean(),
    rows: z.array(importRpeSchema).min(1).max(IMPORT_LIMIT),
  }),
  z.object({
    kind: z.literal("wellness"),
    overwrite: z.boolean(),
    rows: z.array(importWellnessSchema).min(1).max(IMPORT_LIMIT),
  }),
]);
const aliases: Record<string, string> = {
  athlete_name: "athlete_name",
  選手名: "athlete_name",
  球员姓名: "athlete_name",
  date: "date",
  日付: "date",
  日期: "date",
  number: "athlete_number",
  背番号: "athlete_number",
  号码: "athlete_number",
  球衣号码: "athlete_number",
  選手id: "athlete_id",
  球员id: "athlete_id",
  チームid: "team_id",
  球队id: "team_id",
  チーム: "team",
  球队: "team",
  セッションid: "session_id",
  训练id: "session_id",
  セッション番号: "session_code",
  训练编号: "session_code",
  参加状態: "status",
  出勤状态: "status",
  時間: "minutes",
  参加時間: "minutes",
  实际分钟: "minutes",
  时长: "minutes",
  睡眠時間: "sleep_hours",
  睡眠时长: "sleep_hours",
  睡眠の質: "sleep_quality",
  睡眠质量: "sleep_quality",
  疲労: "fatigue",
  疲劳: "fatigue",
  筋肉痛: "soreness",
  肌肉酸痛: "soreness",
  ストレス: "stress",
  压力: "stress",
  食欲: "appetite",
  体重: "weight",
  コメント: "comment",
  备注: "comment",
};
const allowedHeaders = new Set([
  "athlete_name",
  "athlete_id",
  "athlete_number",
  "team_id",
  "team",
  "date",
  "session_id",
  "session_code",
  "status",
  "minutes",
  "rpe",
  "sleep_hours",
  "sleep_quality",
  "fatigue",
  "soreness",
  "stress",
  "appetite",
  "weight",
  "comment",
]);
function matrixToRows(matrix: string[][]): ImportRow[] {
  if (matrix.length < 2)
    throw new Error("A header and at least one data row are required.");
  const headers = matrix[0].map(
    (v) =>
      aliases[
        v
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase()
      ] ??
      v
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase(),
  );
  if (headers.some((v) => !allowedHeaders.has(v)))
    throw new Error(
      "Unknown column. Use the supplied English template headers.",
    );
  if (new Set(headers).size !== headers.length)
    throw new Error("Duplicate column headers are not allowed.");
  if (headers.length > 20) throw new Error("Too many columns.");
  const rows = matrix
    .slice(1)
    .map((values, i) => ({ row: i + 2, values }))
    .filter((x) => x.values.some((v) => v.trim()));
  if (rows.length > IMPORT_LIMIT)
    throw new Error(`Maximum ${IMPORT_LIMIT} rows per import.`);
  return rows.map(({ row, values }) => {
    if (
      values.length > headers.length &&
      values.slice(headers.length).some((v) => v.trim())
    )
      throw new Error(`Row ${row}: more cells than headers.`);
    return {
      row,
      values: Object.fromEntries(
        headers.map((h, i) => [h, (values[i] ?? "").trim()]),
      ),
    };
  });
}
/** RFC 4180 quoting for CSV; a tab outside quotes selects pasted spreadsheet TSV. */
export function parseDelimited(text: string): ImportRow[] {
  text = text.replace(/^\uFEFF/, "");
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw new Error("Maximum file size is 2 MB.");
  const firstLine = text.split(/\r?\n/, 1)[0];
  let quoted = false,
    delimiter = ",";
  for (let i = 0; i < firstLine.length; i++) {
    if (firstLine[i] === '"') quoted = !quoted;
    else if (firstLine[i] === "\t" && !quoted) {
      delimiter = "\t";
      break;
    }
  }
  const matrix: string[][] = [];
  let row: string[] = [],
    cell = "",
    inQuotes = false,
    afterQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || afterQuote)
        throw new Error("Invalid quote in spreadsheet text.");
      inQuotes = true;
      continue;
    }
    if (c === delimiter) {
      row.push(cell);
      cell = "";
      afterQuote = false;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      matrix.push(row);
      row = [];
      cell = "";
      afterQuote = false;
      if (matrix.length > IMPORT_LIMIT + 20) throw new Error("Too many rows.");
      continue;
    }
    if (afterQuote && c.trim())
      throw new Error("Unexpected text after a quoted cell.");
    if (!afterQuote) cell += c;
  }
  if (inQuotes) throw new Error("Unclosed quote in spreadsheet text.");
  if (cell || row.length) {
    row.push(cell);
    matrix.push(row);
  }
  return matrixToRows(matrix);
}
const entity = (text: string) =>
  text.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_, token: string) => {
      if (token[0] === "#") {
        const n =
          token[1].toLowerCase() === "x"
            ? parseInt(token.slice(2), 16)
            : parseInt(token.slice(1), 10);
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
      }
      return (
        { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<
          string,
          string
        >
      )[token.toLowerCase()];
    },
  );
function xmlText(text: string) {
  return entity(text.replace(/<[^>]*>/g, ""));
}
function attrs(text: string) {
  return Object.fromEntries(
    [...text.matchAll(/([\w:]+)\s*=\s*(["'])(.*?)\2/g)].map((m) => [
      m[1],
      entity(m[3]),
    ]),
  );
}
/** Validate XML structure in one pass before the narrow OOXML extraction below.
 * This also prevents repeated unmatched tags from causing quadratic regex scans. */
function validateXml(xml: string) {
  const stack: string[] = [];
  let offset = 0,
    tokens = 0;
  while (offset < xml.length) {
    const start = xml.indexOf("<", offset);
    if (start < 0) break;
    if (xml.startsWith("<!--", start)) {
      const end = xml.indexOf("-->", start + 4);
      if (end < 0) throw new Error("Malformed XML comment.");
      offset = end + 3;
      continue;
    }
    const end = xml.indexOf(">", start + 1);
    if (end < 0) throw new Error("Malformed XML tag.");
    const raw = xml.slice(start + 1, end);
    if (++tokens > 50000 || raw.includes("<"))
      throw new Error("XML structure exceeds import limits.");
    offset = end + 1;
    if (raw.startsWith("?")) continue;
    if (raw.startsWith("!")) throw new Error("Unsupported XML declaration.");
    const closing = raw.startsWith("/");
    const name = raw.match(/^\/?([A-Za-z_][\w:.-]*)/)?.[1];
    if (!name) throw new Error("Malformed XML name.");
    if (closing) {
      if (stack.pop() !== name) throw new Error("Unbalanced XML tags.");
    } else if (!raw.trimEnd().endsWith("/")) {
      stack.push(name);
      if (stack.length > 32)
        throw new Error("XML nesting exceeds import limits.");
    }
  }
  if (stack.length) throw new Error("Unclosed XML tags.");
}
/** Bounded OOXML table reader. No formula evaluation, external links, macros or entity expansion. */
export function parseWorkbook(bytes: Uint8Array): ImportRow[] {
  if (bytes.length > 2 * 1024 * 1024)
    throw new Error("Maximum file size is 2 MB.");
  let total = 0,
    filesCount = 0;
  const files = unzipSync(bytes, {
    filter: (file) => {
      if (
        ++filesCount > 100 ||
        file.originalSize > 4 * 1024 * 1024 ||
        (total += file.originalSize) > 10 * 1024 * 1024
      )
        throw new Error("Workbook expands beyond the import limit.");
      if (
        file.name.includes("..") ||
        file.name.startsWith("/") ||
        /vbaProject|externalLinks|\.bin$/i.test(file.name)
      )
        throw new Error(
          "Macros and external-linked workbooks are not supported.",
        );
      return /^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml)|\[Content_Types\]\.xml)$/.test(
        file.name,
      );
    },
  });
  const read = (path: string) => {
    const value = files[path];
    if (!value) return "";
    if (value.length > 4 * 1024 * 1024)
      throw new Error("Worksheet is too large.");
    const xml = strFromU8(value);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml))
      throw new Error("XML entities are not supported.");
    validateXml(xml);
    return xml;
  };
  const workbook = read("xl/workbook.xml");
  const first = workbook.match(/<(?:\w+:)?sheet\b([^>]*?)(?:\/>|>)/);
  if (!first) throw new Error("Workbook has no sheet.");
  const id = attrs(first[1])["r:id"];
  const relations = read("xl/_rels/workbook.xml.rels");
  let target = "";
  for (const m of relations.matchAll(/<(?:\w+:)?Relationship\b([^>]*?)\/>/g)) {
    const a = attrs(m[1]);
    if (a.Id === id) {
      if (a.TargetMode === "External")
        throw new Error("External worksheets are not supported.");
      target = a.Target;
    }
  }
  const path = target.startsWith("/xl/") ? target.slice(1) : "xl/" + target;
  if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    throw new Error("Unsupported worksheet relationship.");
  const sheet = read(path);
  if (!sheet) throw new Error("The first worksheet is missing.");
  if (/<(?:\w+:)?f(?:\s|>|\/)/.test(sheet))
    throw new Error("Formula cells are not accepted. Paste values only.");
  const shared = [
    ...read("xl/sharedStrings.xml").matchAll(
      /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g,
    ),
  ].map((m) => xmlText(m[1]));
  if (shared.length > 20000) throw new Error("Too many shared strings.");
  const matrix: string[][] = [];
  let cellCount = 0;
  for (const match of sheet.matchAll(
    /<(?:\w+:)?row\b([^>]*?)>([\s\S]*?)<\/(?:\w+:)?row>/g,
  )) {
    const index = Number(attrs(match[1]).r);
    if (!Number.isInteger(index) || index < 1 || index > IMPORT_LIMIT + 1)
      throw new Error(
        "Worksheet row range exceeds 501; remove unused formatted rows.",
      );
    while (matrix.length < index) matrix.push([]);
    const row = matrix[index - 1];
    for (const c of match[2].matchAll(
      /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g,
    )) {
      if (++cellCount > 20000) throw new Error("Too many cells.");
      const a = attrs(c[1]);
      const ref = a.r?.match(/^([A-Z]+)\d+$/);
      if (!ref) throw new Error("Cell reference is required.");
      const col =
        [...ref[1]].reduce((n, s) => n * 26 + s.charCodeAt(0) - 64, 0) - 1;
      if (col > 19) throw new Error("Maximum 20 columns.");
      const body = c[2] ?? "";
      const v =
        body.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1] ?? "";
      if (a.t === "e") throw new Error(`Row ${index}: Excel error cell.`);
      if (a.t === "s") {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n >= shared.length)
          throw new Error("Invalid shared string reference.");
        row[col] = shared[n];
      } else row[col] = a.t === "inlineStr" ? xmlText(body) : entity(v);
    }
  }
  return matrixToRows(
    matrix.map((row) =>
      Array.from({ length: row.length }, (_, i) => row[i] ?? ""),
    ),
  );
}
function validDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date + "T12:00:00Z").toISOString().slice(0, 10) === date
  );
}
export function previewImport(
  rows: ImportRow[],
  kind: ImportKind,
  data: Dataset,
  role: Role,
  expectedSessionId?: string,
): ImportPreview {
  const items: PreviewItem[] = [],
    errors: ImportIssue[] = [],
    skippedRows: ImportIssue[] = [],
    keys = new Map<string, number>();
  if (!["administrator", "coach"].includes(role))
    return {
      items,
      errors: [
        { row: 0, message: "This role cannot import this type of record." },
      ],
    };
  for (const row of rows) {
    try {
      const v = row.values;
      const enteredDate = v.date ?? "";
      const dateParts = enteredDate.match(
        /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/,
      );
      const date = dateParts
        ? `${dateParts[1]}-${dateParts[2].padStart(2, "0")}-${dateParts[3].padStart(2, "0")}`
        : enteredDate;
      if (!validDate(date))
        throw new Error(
          "date must be a valid YYYY-MM-DD or YYYY/M/D value. Prefer the Excel template to preserve date text.",
        );
      const teams = v.team_id
        ? data.teams.filter((t) => t.id === v.team_id)
        : data.teams.filter((t) => t.name === v.team);
      if (teams.length !== 1)
        throw new Error(
          "Unknown or ambiguous team; use team_id or an exact unique team name.",
        );
      const team = teams[0];
      const athletes = data.athletes.filter(
        (a) =>
          (a.team_ids ?? [a.team_id]).includes(team.id) &&
          (v.athlete_id
            ? a.id === v.athlete_id
            : v.athlete_number !== "" &&
              v.athlete_number !== undefined &&
              a.number === Number(v.athlete_number)),
      );
      if (athletes.length !== 1)
        throw new Error(
          "Unknown or ambiguous athlete; use athlete_id or a unique jersey number within the team.",
        );
      const a = athletes[0];
      let value: ImportedRpe | ImportedWellness;
      let sessionLabel = "—",
        existing = false,
        key = "";
      const num = (key: string) => {
        if (v[key] === undefined || v[key].trim() === "")
          throw new Error(`${key} is required.`);
        const n = Number(v[key]);
        if (!Number.isFinite(n)) throw new Error(`${key} must be numeric.`);
        return n;
      };
      if (kind === "rpe") {
        const sessions = data.sessions.filter(
          (s) =>
            s.date === date &&
            s.team_id === team.id &&
            (v.session_id ? s.id === v.session_id : s.code === v.session_code),
        );
        if (sessions.length !== 1)
          throw new Error(
            "Unknown or ambiguous session for this date and team.",
          );
        const s = sessions[0];
        if (!s.athlete_ids.includes(a.id))
          throw new Error("Athlete is not assigned to this session.");
        if (expectedSessionId && s.id !== expectedSessionId)
          throw new Error("Session does not match the selected training.");
        if (v.status === "pending" && !v.rpe?.trim()) {
          const m = v.minutes?.trim() ? num("minutes") : s.duration;
          if (!Number.isInteger(m) || m < 0 || m > 600)
            throw new Error("minutes must be 0–600.");
          const pendingKey = `${a.id}:${s.id}`;
          if (keys.has(pendingKey))
            throw new Error(
              `Duplicate athlete/date/session; first appears at row ${keys.get(pendingKey)}.`,
            );
          keys.set(pendingKey, row.row);
          skippedRows.push({
            row: row.row,
            message: `${a.name}: RPE未記入のため未提出のまま保持 / Pending, not imported`,
          });
          continue;
        }
        const status = (
          v.status === "pending" ? "attended" : v.status || "attended"
        ) as ImportedRpe["status"];
        const participating = ["attended", "rehabilitation"].includes(status);
        const minutes = v.minutes?.trim()
          ? num("minutes")
          : participating
            ? s.duration
            : 0;
        const rpe = v.rpe?.trim() ? num("rpe") : null;
        if (
          minutes < 0 ||
          minutes > 600 ||
          !Number.isInteger(minutes) ||
          (rpe !== null && (rpe < 0 || rpe > 10)) ||
          (participating && rpe === null) ||
          (!participating && (minutes !== 0 || rpe !== null)) ||
          ![
            "attended",
            "rehabilitation",
            "rest",
            "absent",
            "not_participating",
          ].includes(status)
        )
          throw new Error(
            "Invalid attendance, minutes (0–600), or RPE (0–10). Rest/absence requires minutes=0 and blank RPE.",
          );
        value = {
          athlete_id: a.id,
          session_id: s.id,
          date,
          team_id: team.id,
          status,
          minutes,
          rpe,
        };
        sessionLabel = s.code;
        existing = data.entries.some(
          (e) =>
            e.athlete_id === a.id &&
            e.session_id === s.id &&
            e.status !== "pending",
        );
        key = `${a.id}:${s.id}`;
      } else {
        const measurements = Object.fromEntries(
          [
            "sleep_hours",
            "sleep_quality",
            "fatigue",
            "soreness",
            "stress",
            "appetite",
            "weight",
          ].map((k) => [k, num(k)]),
        );
        if (
          measurements.sleep_hours < 0 ||
          measurements.sleep_hours > 24 ||
          measurements.weight < 20 ||
          measurements.weight > 300
        )
          throw new Error("Sleep must be 0–24 h and weight 20–300 kg.");
        for (const key of [
          "sleep_quality",
          "fatigue",
          "soreness",
          "stress",
          "appetite",
        ] as const) {
          const scale = data.settings.scales[key];
          if (
            !Number.isInteger(measurements[key]) ||
            measurements[key] < scale.min ||
            measurements[key] > scale.max
          )
            throw new Error(`${key} must be ${scale.min}–${scale.max}.`);
        }
        if ((v.comment ?? "").length > 2000)
          throw new Error("Comment exceeds 2000 characters.");
        value = {
          athlete_id: a.id,
          date,
          ...measurements,
          comment: v.comment ?? "",
        } as ImportedWellness;
        existing = data.wellness.some(
          (w) => w.athlete_id === a.id && w.date === date,
        );
        key = `${a.id}:${date}`;
      }
      if (keys.has(key))
        throw new Error(
          `Duplicate athlete/date/session; first appears at row ${keys.get(key)}.`,
        );
      keys.set(key, row.row);
      items.push({
        row: row.row,
        athlete: a.name,
        session: sessionLabel,
        date,
        existing,
        value,
      });
    } catch (e) {
      errors.push({
        row: row.row,
        message: e instanceof Error ? e.message : "Invalid row.",
      });
    }
  }
  if (!rows.length) errors.push({ row: 0, message: "No data rows." });
  return { items, errors, skippedRows };
}
