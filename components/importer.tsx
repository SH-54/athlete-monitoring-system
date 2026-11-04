"use client";
import { useState } from "react";
import {
  ArrowDownToLine,
  FileSpreadsheet,
  Upload,
  TriangleAlert,
  CheckCircle2,
} from "lucide-react";
import {
  parseDelimited,
  parseWorkbook,
  previewImport,
  type ImportKind,
  type ImportPreview,
  type ImportedRpe,
  type ImportedWellness,
} from "@/lib/import";
import { createWorkbook } from "@/lib/export";
import { downloadSessionTemplate } from "@/lib/session-template";
import { isoDate } from "@/lib/analytics";
import type { Dataset, Locale, Viewer } from "@/lib/types";
export default function Importer({
  data,
  viewer,
  demo,
  locale,
  onUpdate,
  notify,
  date = isoDate(new Date()),
  sessionId,
}: {
  data: Dataset;
  viewer: Viewer;
  demo: boolean;
  locale: Locale;
  onUpdate: React.Dispatch<React.SetStateAction<Dataset>>;
  notify: (s: string) => void;
  date?: string;
  sessionId?: string;
}) {
  const text = (zh: string, ja: string, en: string) =>
    locale === "zh" ? zh : locale === "ja" ? ja : en;
  const [kind, setKind] = useState<ImportKind>("rpe"),
    [paste, setPaste] = useState(""),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [overwrite, setOverwrite] = useState(false),
    [busy, setBusy] = useState(false),
    [fileName, setFileName] = useState(""),
    [templateSession, setTemplateSession] = useState(
      sessionId ?? data.sessions.find((s) => s.date === date)?.id ?? "",
    );
  if (!["administrator", "coach"].includes(viewer.role)) return null;
  const existing = preview?.items.filter((x) => x.existing).length ?? 0;
  const count = preview?.items.length ?? 0;
  const saving = overwrite ? count : count - existing;
  function fail(e: unknown) {
    setPreview({
      items: [],
      errors: [
        { row: 0, message: e instanceof Error ? e.message : "Invalid file" },
      ],
    });
  }
  function previewPaste() {
    setFileName(text("粘贴的数据", "貼り付けデータ", "Pasted spreadsheet"));
    try {
      setPreview(
        previewImport(
          parseDelimited(paste),
          kind,
          data,
          viewer.role,
          sessionId,
        ),
      );
    } catch (e) {
      fail(e);
    }
  }
  function template(format: "csv" | "xlsx") {
    if (kind === "rpe") {
      try {
        downloadSessionTemplate(data, templateSession, format);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Export failed");
      }
      return;
    }
    const session = data.sessions.find(
      (s) => s.date === date && s.athlete_ids.length,
    );
    const athlete = session
      ? data.athletes.find((a) => session.athlete_ids.includes(a.id))
      : data.athletes[0];
    const team = data.teams.find(
      (t) => t.id === (session?.team_id ?? athlete?.team_id),
    );
    const row: Record<string, string | number> = {
      athlete_id: athlete?.id ?? "",
      team_id: team?.id ?? "",
      date,
    };
    {
      const mid = (key: keyof Dataset["settings"]["scales"]) =>
        Math.round(
          (data.settings.scales[key].min + data.settings.scales[key].max) / 2,
        );
      Object.assign(row, {
        sleep_hours: 8,
        sleep_quality: mid("sleep_quality"),
        fatigue: mid("fatigue"),
        soreness: mid("soreness"),
        stress: mid("stress"),
        appetite: mid("appetite"),
        weight: 70,
        comment: "",
      });
    }
    const content =
      format === "xlsx"
        ? new Uint8Array(createWorkbook([row])).buffer
        : "\uFEFF" +
          Object.keys(row).join(",") +
          "\r\n" +
          Object.values(row)
            .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
            .join(",");
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
    a.download = `athlos-${kind}-import-template.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function apply() {
    if (!preview || preview.errors.length || !saving) return;
    setBusy(true);
    try {
      let saved = saving,
        skipped = count - saving;
      if (!demo) {
        const r = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            overwrite,
            rows: preview.items.map((i) => i.value),
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        saved = j.saved;
        skipped = j.skipped;
        location.reload();
      } else
        onUpdate((d) => {
          const next = {
            ...d,
            entries: [...d.entries],
            wellness: [...d.wellness],
          };
          for (const item of preview.items) {
            if (item.existing && !overwrite) continue;
            if (kind === "rpe") {
              const v = item.value as ImportedRpe;
              const index = next.entries.findIndex(
                (e) =>
                  e.athlete_id === v.athlete_id &&
                  e.session_id === v.session_id,
              );
              const { date: _, team_id: __, ...entry } = v;
              if (index >= 0) next.entries[index] = entry;
            } else {
              const v = item.value as ImportedWellness;
              next.wellness = [
                ...next.wellness.filter(
                  (w) => !(w.athlete_id === v.athlete_id && w.date === v.date),
                ),
                v,
              ];
            }
          }
          return next;
        });
      notify(
        text(
          `已保存 ${saved} 条，保留原记录 ${skipped} 条。`,
          `保存 ${saved} 件・既存記録を保持 ${skipped} 件。`,
          `Saved ${saved}; kept ${skipped} existing records.`,
        ),
      );
      setPreview(null);
      setPaste("");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel import-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">STAFF PROXY ENTRY</span>
          <h2>
            <FileSpreadsheet size={18} />
            {text("批量代理填报", "代理入力・一括取り込み", "Bulk proxy entry")}
          </h2>
        </div>
        <span className="pill neutral">CSV / XLSX / TSV</span>
      </div>
      <p className="muted">
        {text(
          "每一行对应一名球员、一天、一次训练。三练请分别填写三行。默认保留已提交记录；导入前请先检查预览。",
          "1行が「1選手・1日・1セッション」です。3部練では3行に分けます。提出済み記録は初期設定で保持し、保存前にプレビューを確認します。",
          "One row = one athlete, date and session. Use three rows for three sessions. Existing submissions are preserved by default; review the preview before saving.",
        )}
      </p>
      <div className="import-options">
        <label>
          {text("导入类型", "取り込み種別", "Import type")}
          <select
            aria-label="Import type"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ImportKind);
              setPreview(null);
              setPaste("");
            }}
          >
            <option value="rpe">
              {text(
                "训练后 RPE（按训练）",
                "練習後RPE（セッション別）",
                "Post-training RPE (per session)",
              )}
            </option>
            {<option value="wellness">Morning Wellness</option>}
          </select>
        </label>
        {kind === "rpe" && (
          <label>
            {text("输入表的训练", "入力表のセッション", "Template session")}
            <select
              aria-label="Template session"
              value={templateSession}
              disabled={!!sessionId}
              onChange={(e) => setTemplateSession(e.target.value)}
            >
              <option value="" disabled>
                —
              </option>
              {data.sessions
                .filter((s) => s.date === date)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.type} · {s.start_time.slice(0, 5)}
                  </option>
                ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="secondary"
          onClick={() => template("xlsx")}
        >
          <ArrowDownToLine size={15} />
          Excel {text("模板", "テンプレート", "template")}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => template("csv")}
        >
          CSV {text("模板", "テンプレート", "template")}
        </button>
      </div>
      {kind === "rpe" && (
        <p className="setup-note">
          {text(
            "输入表含该训练全部目标球员。pending 行仅填写 RPE 即转为已参加；RPE 留空则保留未提交。已有记录会保留原值，导入默认不覆盖。",
            "入力表にはその練習の対象選手全員が入ります。pending 行はRPEを入力すると参加済みになり、空欄のままなら未提出として保持します。既存記録は元の値を出力し、取り込み時も初期設定で保護します。",
            "The sheet includes the full assigned roster. Fill RPE on pending rows to submit; leave it blank to keep pending. Existing values are exported and protected by default.",
          )}
        </p>
      )}
      <p className="import-help">
        {text(
          "请使用模板英文表头。可用 athlete_id，或 athlete_number + team_id/team 精确匹配。date 请用文本 YYYY-MM-DD；session_id 或 session_code + 日期 + 球队定位训练。支持最多500行、2MB，XLSX仅读取第一张工作表，不接受公式。",
          "テンプレートの英語列名を使用します。athlete_id、または背番号 athlete_number と team_id/team で選手を特定します。date は文字列 YYYY-MM-DD、session_id または session_code＋日付＋チームでセッションを特定します。最大500行・2MB。XLSXは先頭シートの値のみ対応し、数式は受け付けません。",
          "Use template English headers. Identify athletes by athlete_id or athlete_number + exact team_id/team. Use text YYYY-MM-DD dates and session_id or session_code + date + team. Maximum 500 rows / 2 MB. XLSX reads the first sheet, values only; formulas are rejected.",
        )}
      </p>
      <div className="import-inputs">
        <label>
          {text(
            "选择 Excel / CSV 文件",
            "Excel / CSV ファイル",
            "Choose Excel / CSV file",
          )}
          <input
            aria-label="Import file"
            type="file"
            accept=".csv,.xlsx,.tsv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setFileName(file.name);
              try {
                if (file.size > 2 * 1024 * 1024)
                  throw new Error("Maximum file size is 2 MB.");
                const rows = /\.xlsx$/i.test(file.name)
                  ? parseWorkbook(new Uint8Array(await file.arrayBuffer()))
                  : /\.(csv|tsv)$/i.test(file.name)
                    ? parseDelimited(await file.text())
                    : (() => {
                        throw new Error(
                          "Only .xlsx, .csv and .tsv files are supported.",
                        );
                      })();
                setPreview(
                  previewImport(rows, kind, data, viewer.role, sessionId),
                );
              } catch (error) {
                fail(error);
              } finally {
                e.target.value = "";
              }
            }}
          />
        </label>
        <label>
          {text(
            "或从 Excel / Google Sheets 复制并粘贴（含表头）",
            "または Excel / Google Sheets から列名付きで貼り付け",
            "Or paste from Excel / Google Sheets including headers",
          )}
          <textarea
            aria-label="Paste spreadsheet"
            rows={5}
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              setPreview(null);
            }}
            placeholder="athlete_id&#9;team_id&#9;date&#9;session_code&#9;minutes&#9;rpe"
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={previewPaste}
          disabled={!paste.trim()}
        >
          <Upload size={15} />
          {text("预览粘贴数据", "貼り付けをプレビュー", "Preview pasted data")}
        </button>
      </div>
      {preview && (
        <div className="import-preview">
          <div className="panel-heading">
            <h3>
              {text("导入预览", "取り込みプレビュー", "Import preview")} ·{" "}
              {fileName}
            </h3>
            <span>
              {count} {text("条", "件", "rows")}
            </span>
          </div>
          {!!preview.skippedRows?.length && (
            <details className="auth-message">
              <summary>
                {preview.skippedRows.length}{" "}
                {text(
                  "条未填写RPE，保持未提交。",
                  "行はRPE未記入のため取り込みません（未提出を保持）。",
                  "blank RPE rows remain pending.",
                )}
              </summary>
              <ul>
                {preview.skippedRows.map((r) => (
                  <li key={r.row}>
                    Row {r.row}: {r.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {preview.errors.length > 0 && (
            <div className="import-errors" role="alert">
              <strong>
                <TriangleAlert size={16} />
                {text(
                  "请修正所有错误后再保存。没有记录被导入。",
                  "すべてのエラーを修正してください。まだ保存されていません。",
                  "Fix all errors before saving. No records have been imported.",
                )}
              </strong>
              <ul>
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    {text("行", "行", "Row")} {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>{text("球员", "選手", "Athlete")}</th>
                  <th>{text("日期", "日付", "Date")}</th>
                  <th>{text("训练", "セッション", "Session")}</th>
                  <th>RPE / Wellness</th>
                  <th>{text("时长", "時間", "Minutes")}</th>
                  <th>{text("保存操作", "保存動作", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((i) => (
                  <tr key={i.row}>
                    <td>{i.row}</td>
                    <td>{i.athlete}</td>
                    <td>{i.date}</td>
                    <td>{i.session}</td>
                    <td>
                      {"rpe" in i.value
                        ? `${i.value.rpe ?? "—"} · ${i.value.status}`
                        : `${i.value.sleep_hours} h · fatigue ${i.value.fatigue}`}
                    </td>
                    <td>{"minutes" in i.value ? i.value.minutes : "—"}</td>
                    <td>
                      {i.existing
                        ? overwrite
                          ? text(
                              "覆盖已有记录",
                              "既存を上書き",
                              "Overwrite existing",
                            )
                          : text("保留已有记录", "既存を保持", "Keep existing")
                        : text(
                            "新增 / 补全",
                            "新規・未入力を補完",
                            "New / complete pending",
                          )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="import-overwrite">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            <span>
              {text(
                "覆盖已有提交记录（请确认后选择）",
                "提出済み記録を上書きする（必要な場合のみ）",
                "Overwrite existing submissions (explicit opt-in)",
              )}
            </span>
          </label>
          <p className="muted">
            {saving} {text("条将保存", "件を保存", "to save")} ·{" "}
            {count - saving} {text("条保留", "件を保持", "kept")} ·{" "}
            {preview.errors.length} {text("个错误", "件のエラー", "errors")}
          </p>
          <button
            type="button"
            className="primary"
            disabled={busy || preview.errors.length > 0 || !saving}
            onClick={apply}
          >
            <CheckCircle2 size={16} />
            {busy
              ? text("保存中…", "保存中…", "Saving…")
              : text(
                  "确认并保存导入",
                  "確認して取り込みを保存",
                  "Confirm and save import",
                )}
          </button>
        </div>
      )}
    </section>
  );
}
