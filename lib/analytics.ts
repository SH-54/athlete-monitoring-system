import type { Dataset, Athlete, Settings } from "./types";
/** Team reporting date; never derive it from the execution host timezone. */
export const isoDate = (d: Date, timeZone = "Asia/Shanghai") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
export function shiftDate(day: string, offset: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function dailyLoad(
  data: Dataset,
  id: string,
  date: string,
): number | null {
  const sessions = data.sessions.filter(
    (s) => s.date === date && s.athlete_ids.includes(id),
  );
  const entries = sessions.map((s) =>
    data.entries.find((e) => e.session_id === s.id && e.athlete_id === id),
  );
  if (
    !sessions.length ||
    entries.some(
      (e) =>
        !e ||
        e.status === "pending" ||
        ((e.status === "attended" || e.status === "rehabilitation") &&
          e.rpe === null),
    )
  )
    return null;
  return entries.reduce(
    (n, e) =>
      n +
      (e && ["attended", "rehabilitation"].includes(e.status)
        ? e.minutes * (e.rpe ?? 0)
        : 0),
    0,
  );
}
export function rolling(values: (number | null)[], days: number) {
  const tail = values.slice(-days);
  return tail.length === days && tail.every((v) => v !== null)
    ? (tail as number[]).reduce((a, b) => a + b, 0)
    : null;
}
export function ewma(values: (number | null)[], days: number) {
  if (values.length < days || values.some((v) => v === null)) return null;
  const a = 2 / (days + 1);
  return (values as number[]).reduce(
    (n, v, i) => (i === 0 ? v : a * v + (1 - a) * n),
    0,
  );
}
export function loadMetrics(
  values: (number | null)[],
  method: Settings["acwr"] = "coupled",
) {
  const acute = rolling(values, 7),
    chronic = rolling(values, 28),
    week = values.slice(-7);
  let monotony: number | null = null;
  if (week.length === 7 && week.every((v) => v !== null)) {
    const mean = acute! / 7;
    const sd = Math.sqrt(
      (week as number[]).reduce((n, v) => n + (v - mean) ** 2, 0) / 7,
    );
    monotony = sd > 0 ? mean / sd : null;
  }
  let denominator =
    method === "uncoupled" ? rolling(values.slice(0, -7), 28) : chronic;
  const numerator =
    method === "ewma" ? ewma(values, 7) : acute === null ? null : acute / 7;
  denominator =
    method === "ewma"
      ? ewma(values, 28)
      : denominator === null
        ? null
        : denominator / 28;
  return {
    acute,
    chronic,
    monotony,
    strain: monotony === null || acute === null ? null : monotony * acute,
    ewma7: ewma(values, 7),
    ewma28: ewma(values, 28),
    acwr: numerator === null || !denominator ? null : numerator / denominator,
  };
}
export function alerts(data: Dataset, athlete: Athlete, date: string) {
  const w = data.wellness.find(
      (x) => x.athlete_id === athlete.id && x.date === date,
    ),
    p = data.pain.filter((x) => x.athlete_id === athlete.id && x.date === date),
    s = data.settings;
  const result: { kind: string; value: string; level: "warning" | "danger" }[] =
    [];
  if (w && w.sleep_hours < s.sleepMin)
    result.push({
      kind: "sleep",
      value: `${w.sleep_hours}h < ${w.sleep_hours < (s.sleepRedMin ?? 5) ? (s.sleepRedMin ?? 5) : s.sleepMin}h`,
      level: w.sleep_hours < (s.sleepRedMin ?? 5) ? "danger" : "warning",
    });
  if (w) {
    const scale = s.scales.fatigue;
    const bad =
      scale.direction === "higher_worse"
        ? w.fatigue >= s.fatigueMax
        : w.fatigue <= s.fatigueMax;
    if (bad)
      result.push({
        kind: "fatigue",
        value: `${w.fatigue} ${scale.direction === "higher_worse" ? "≥" : "≤"} ${(scale.direction === "higher_worse" ? w.fatigue >= (s.fatigueRed ?? scale.max) : w.fatigue <= (s.fatigueRed ?? scale.min)) ? (s.fatigueRed ?? (scale.direction === "higher_worse" ? scale.max : scale.min)) : s.fatigueMax}`,
        level: (
          scale.direction === "higher_worse"
            ? w.fatigue >= (s.fatigueRed ?? scale.max)
            : w.fatigue <= (s.fatigueRed ?? scale.min)
        )
          ? "danger"
          : "warning",
      });
  }
  p.filter((x) => x.severity >= s.painMin).forEach((x) =>
    result.push({
      kind: "pain",
      value: `${x.body_part}: ${x.severity}/10 ≥ ${x.severity >= (s.painRedMin ?? 5) ? (s.painRedMin ?? 5) : s.painMin}`,
      level: x.severity >= (s.painRedMin ?? 5) ? "danger" : "warning",
    }),
  );
  const previous = data.wellness
    .filter((x) => x.athlete_id === athlete.id && x.date < date)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (w && previous[0]?.weight) {
    const pct =
      (Math.abs(w.weight - previous[0].weight) / previous[0].weight) * 100;
    if (pct >= s.weightChangePct)
      result.push({
        kind: "weight",
        value: `${pct.toFixed(1)}% ≥ ${s.weightChangePct}%`,
        level: "warning",
      });
  }
  if (w && previous.length >= 7) {
    const avg = previous.slice(0, 7).reduce((a, b) => a + b.fatigue, 0) / 7;
    const delta =
      s.scales.fatigue.direction === "higher_worse"
        ? w.fatigue - avg
        : avg - w.fatigue;
    if (delta >= s.wellnessDeviation)
      result.push({
        kind: "baseline",
        value: `Δ ${delta.toFixed(1)} ≥ ${s.wellnessDeviation}`,
        level: "warning",
      });
  }
  const load = dailyLoad(data, athlete.id, date);
  if (load !== null && load > s.loadMax)
    result.push({
      kind: "load",
      value:
        load >= (s.loadRedMax ?? 1000)
          ? `${load} AU ≥ ${s.loadRedMax ?? 1000} AU`
          : `${load} AU > ${s.loadMax} AU`,
      level: load >= (s.loadRedMax ?? 1000) ? "danger" : "warning",
    });
  if (w && previous[0]) {
    const scale = s.scales.sleep_quality;
    const drop =
      scale.direction === "higher_better"
        ? previous[0].sleep_quality - w.sleep_quality
        : w.sleep_quality - previous[0].sleep_quality;
    if (drop >= s.sleepQualityDrop)
      result.push({
        kind: "sleep",
        value: `Δ quality ${drop.toFixed(1)} ≥ ${s.sleepQualityDrop}`,
        level: "warning",
      });
  }
  for (const pain of p) {
    if (
      pain.severity >= s.newPainMin &&
      pain.severity < s.painMin &&
      !data.pain.some(
        (old) =>
          old.athlete_id === athlete.id &&
          old.date < date &&
          old.date >= shiftDate(date, -7) &&
          old.body_part === pain.body_part,
      )
    )
      result.push({
        kind: "pain",
        value: `${pain.body_part}: new ${pain.severity}/10 ≥ ${s.newPainMin}`,
        level: "warning",
      });
  }
  const baseline = Array.from({ length: 7 }, (_, i) =>
    dailyLoad(data, athlete.id, shiftDate(date, -i - 1)),
  );
  if (load !== null && baseline.every((v) => v !== null)) {
    const mean = (baseline as number[]).reduce((a, b) => a + b, 0) / 7;
    if (mean > 0 && ((load - mean) / mean) * 100 >= s.loadSpikePct)
      result.push({
        kind: "load",
        value: `${load} AU / ${mean.toFixed(0)} AU; +${(((load - mean) / mean) * 100).toFixed(0)}% ≥ ${s.loadSpikePct}%`,
        level: "warning",
      });
  }
  return result;
}
export function periodLoad(
  data: Dataset,
  id: string,
  start: string,
  end: string,
) {
  let total = 0,
    missing = 0;
  for (let d = start; d <= end; d = shiftDate(d, 1)) {
    const v = dailyLoad(data, id, d);
    if (v === null) missing++;
    else total += v;
  }
  return { total, missing };
}

export type FlagLevel = "red" | "yellow" | "normal" | "missing";
/** Missing is an explicit state, never a green clearance. */
export function flagLevel(
  data: Dataset,
  athlete: Athlete,
  date: string,
): FlagLevel {
  const findings = alerts(data, athlete, date);
  if (findings.some((a) => a.level === "danger")) return "red";
  if (findings.length) return "yellow";
  return data.wellness.some(
    (w) => w.athlete_id === athlete.id && w.date === date,
  ) && dailyLoad(data, athlete.id, date) !== null
    ? "normal"
    : "missing";
}
/** A raw daily-load comparison; do not apply to weekly totals or team means. */
export function loadFlag(load: number | null, settings: Settings): FlagLevel {
  if (load === null) return "missing";
  if (load > settings.loadMax && load >= (settings.loadRedMax ?? 1000))
    return "red";
  return load > settings.loadMax ? "yellow" : "normal";
}
export const flagColors: Record<FlagLevel, string> = {
  red: "#c64b45",
  yellow: "#c28b25",
  normal: "#81976e",
  missing: "#9aa39a",
};

/** Shared with settings form and server validation to prevent reversed severity bands. */
export function thresholdErrors(settings: Settings): string[] {
  const errors: string[] = [];
  if (settings.sleepRedMin > settings.sleepMin)
    errors.push("Red sleep threshold must be at or below yellow.");
  if (settings.painRedMin < settings.painMin)
    errors.push("Red pain threshold must be at or above yellow.");
  if (settings.loadRedMax <= settings.loadMax)
    errors.push("Red load threshold must be above yellow.");
  const scale = settings.scales.fatigue;
  if (
    settings.fatigueMax < scale.min ||
    settings.fatigueMax > scale.max ||
    settings.fatigueRed < scale.min ||
    settings.fatigueRed > scale.max
  )
    errors.push("Fatigue thresholds must be within the configured scale.");
  if (
    (scale.direction === "higher_worse" &&
      settings.fatigueRed < settings.fatigueMax) ||
    (scale.direction === "higher_better" &&
      settings.fatigueRed > settings.fatigueMax)
  )
    errors.push(
      "Red fatigue threshold must be at least as severe as yellow in the configured scale direction.",
    );
  return errors;
}
