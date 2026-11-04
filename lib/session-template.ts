import type { Dataset } from "./types";
import { createWorkbook } from "./export";
export function sessionTemplateRows(data: Dataset, sessionId: string) {
  const s = data.sessions.find((s) => s.id === sessionId);
  if (!s) throw new Error("セッションを選択してください。");
  const roster = data.athletes
    .filter((a) => s.athlete_ids.includes(a.id))
    .sort((a, b) => a.number - b.number);
  if (roster.length !== s.athlete_ids.length)
    throw new Error("対象選手の情報を取得できません。更新してください。");
  return roster.map((a) => {
    const e = data.entries.find(
      (e) => e.athlete_id === a.id && e.session_id === s.id,
    );
    return {
      athlete_id: a.id,
      athlete_number: a.number,
      athlete_name: a.name,
      team_id: s.team_id,
      date: s.date,
      session_id: s.id,
      session_code: s.code,
      status: e?.status ?? "pending",
      minutes: e?.status === "pending" || !e ? s.duration : e.minutes,
      rpe: e?.rpe ?? "",
    };
  });
}
export function sessionTemplateFile(
  data: Dataset,
  sessionId: string,
  format: "csv" | "xlsx",
) {
  const rows = sessionTemplateRows(data, sessionId);
  if (!rows.length) throw new Error("対象選手がいません。");
  const safe = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return format === "xlsx"
    ? new Uint8Array(createWorkbook(rows)).buffer
    : "\uFEFF" +
        [
          Object.keys(rows[0]).map(safe).join(","),
          ...rows.map((row) => Object.values(row).map(safe).join(",")),
        ].join("\r\n");
}
export function downloadSessionTemplate(
  data: Dataset,
  id: string,
  format: "csv" | "xlsx",
) {
  const content = sessionTemplateFile(data, id, format),
    s = data.sessions.find((s) => s.id === id)!;
  const url = URL.createObjectURL(
    new Blob([content], {
      type:
        format === "csv"
          ? "text/csv;charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `athlos-${s.date}-${s.code.replace(/[^A-Za-z0-9_-]/g, "_")}-input.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
