"use client";
import { useState } from "react";
import { dictionaries, sessionTypeLabel } from "@/lib/i18n";
import { formatMessage } from "@/lib/locales";
import { importIssue } from "@/lib/localized-errors";
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
  const t = dictionaries[locale];
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
    setFileName(t.importPastedSpreadsheet);
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
        notify(t.importExportError);
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
        if (!r.ok) throw new Error(t.importFailed);
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
      notify(formatMessage(t.importSaved, { saved, skipped }));
      setPreview(null);
      setPaste("");
    } catch (e) {
      notify(t.importFailed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel import-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t.proxyEntry}</span>
          <h2>
            <FileSpreadsheet size={18} />
            {t.importBulkProxyEntry}
          </h2>
        </div>
        <span className="pill neutral">CSV / XLSX / TSV</span>
      </div>
      <p className="muted">{t.importHelp}</p>
      <div className="import-options">
        <label>
          {t.importImportType}
          <select
            aria-label={t.importImportType}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ImportKind);
              setPreview(null);
              setPaste("");
            }}
          >
            <option value="rpe">{t.importPosttrainingRPEPerSession}</option>
            {<option value="wellness">{t.morning}</option>}
          </select>
        </label>
        {kind === "rpe" && (
          <label>
            {t.importTemplateSession}
            <select
              aria-label={t.importTemplateSession}
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
                    {s.code} · {sessionTypeLabel(s.type, t)} ·{" "}
                    {s.start_time.slice(0, 5)}
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
          Excel {t.importTemplate}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => template("csv")}
        >
          CSV {t.importTemplate}
        </button>
      </div>
      {kind === "rpe" && <p className="setup-note">{t.sessionTemplateHelp}</p>}
      <p className="import-help">{t.importFormatHelp}</p>
      <div className="import-inputs">
        <label>
          {t.importChooseExcelCSVFile}
          <input
            aria-label={t.importFile}
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
          {t.importOrPasteFromExcelGoogleSheetsIncluding}
          <textarea
            aria-label={t.importPaste}
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
          {t.importPreviewPastedData}
        </button>
      </div>
      {preview && (
        <div className="import-preview">
          <div className="panel-heading">
            <h3>
              {t.importImportPreview} · {fileName}
            </h3>
            <span>
              {count} {t.importRows}
            </span>
          </div>
          {!!preview.skippedRows?.length && (
            <details className="auth-message">
              <summary>
                {preview.skippedRows.length} {t.importBlankRPERowsRemainPending}
              </summary>
              <ul>
                {preview.skippedRows.map((r) => (
                  <li key={r.row}>
                    {t.importRow}
                    {r.row}: {importIssue(r.message, t)}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {preview.errors.length > 0 && (
            <div className="import-errors" role="alert">
              <strong>
                <TriangleAlert size={16} />
                {t.importFixAllErrorsBeforeSavingNoRecords}
              </strong>
              <ul>
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    {t.importRow} {e.row}: {importIssue(e.message, t)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t.importRow}</th>
                  <th>{t.athlete}</th>
                  <th>{t.date}</th>
                  <th>{t.importSession}</th>
                  <th>RPE / {t.wellness}</th>
                  <th>{t.importMinutes}</th>
                  <th>{t.importAction}</th>
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
                        ? `${i.value.rpe ?? "—"} · ${t[i.value.status]}`
                        : `${i.value.sleep_hours} h · ${t.fatigue} ${i.value.fatigue}`}
                    </td>
                    <td>{"minutes" in i.value ? i.value.minutes : "—"}</td>
                    <td>
                      {i.existing
                        ? overwrite
                          ? t.importOverwriteExisting
                          : t.importKeepExisting
                        : t.importNewCompletePending}
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
            <span>{t.importOverwriteExistingSubmissionsExplicitOptin}</span>
          </label>
          <p className="muted">
            {saving} {t.importToSave} · {count - saving} {t.importKept} ·{" "}
            {preview.errors.length} {t.importErrors}
          </p>
          <button
            type="button"
            className="primary"
            disabled={busy || preview.errors.length > 0 || !saving}
            onClick={apply}
          >
            <CheckCircle2 size={16} />
            {busy ? t.loading : t.importConfirmAndSaveImport}
          </button>
        </div>
      )}
    </section>
  );
}
