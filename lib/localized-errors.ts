import type { Labels } from "./i18n";
import { formatMessage } from "./locales";

export function authErrorKey(error: unknown): keyof Labels {
  const value = error as { code?: string; message?: string } | null;
  const code = value?.code ?? "";
  const message = value?.message ?? "";
  if (
    code === "invalid_credentials" ||
    /invalid login credentials/i.test(message)
  )
    return "invalidCredentials";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message))
    return "emailUnconfirmed";
  if (["user_already_exists", "email_exists"].includes(code))
    return "accountExists";
  if (
    /rate_limit|over_email_send/.test(code) ||
    /rate limit|too many requests/i.test(message)
  )
    return "emailLimit";
  if (["weak_password", "same_password"].includes(code)) return "weakPassword";
  return "connectionError";
}

export function importIssue(message: string, t: Labels): string {
  if (/Pending, not imported/.test(message))
    return message.replace(/: RPE未記入.*$/, ": " + t.importPendingRow);
  const field = message.match(
    /^(\w+) (?:is required|must be numeric|must be (\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?))/,
  );
  if (field) {
    const names: Record<string, string> = {
      sleep_hours: t.sleepHours,
      sleep_quality: t.sleepQuality,
      fatigue: t.fatigue,
      soreness: t.soreness,
      stress: t.stress,
      appetite: t.appetite,
      weight: t.weight,
      minutes: t.actualMinutes,
      rpe: "RPE",
    };
    return formatMessage(t.importFieldError, {
      field: names[field[1]] ?? field[1],
      range: field[2] ? `${field[2]}–${field[3]}` : t.importNumericRequired,
    });
  }
  if (/Duplicate athlete/.test(message))
    return formatMessage(t.importDuplicate, {
      row: message.match(/row (\d+)/)?.[1] ?? "—",
    });
  if (/Unknown or ambiguous team/.test(message)) return t.importUnknownTeam;
  if (/Unknown or ambiguous athlete/.test(message))
    return t.importUnknownAthlete;
  if (/Unknown or ambiguous session/.test(message))
    return t.importUnknownSession;
  if (/not assigned/.test(message)) return t.importNotAssigned;
  if (/does not match the selected/.test(message)) return t.importWrongSession;
  if (/^date must/.test(message)) return t.importDateError;
  if (/Invalid attendance/.test(message)) return t.importAttendanceError;
  if (/Sleep must/.test(message)) return t.importWellnessError;
  if (/Comment exceeds/.test(message)) return t.importCommentError;
  if (/This role cannot/.test(message)) return t.importForbidden;
  if (/file size/.test(message)) return t.importFileSize;
  if (/Only .xlsx/.test(message)) return t.importFileType;
  if (/Formula cells/.test(message)) return t.importFormulaError;
  if (/Macros|External|external|entities/.test(message))
    return t.importExternalError;
  if (/header|column/i.test(message)) return t.importHeadersError;
  if (/No data rows|at least one data/.test(message)) return t.importNoRows;
  if (/rows|501|Too many|limit|too large/.test(message))
    return t.importLimitError;
  return t.importInvalidFile;
}
