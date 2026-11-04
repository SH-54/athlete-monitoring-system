import { defaultSettings } from "./demo";
import type { Settings } from "./types";
/** Extend earlier organization settings without reversing newly introduced severity bands. */
export function normalizeSettings(raw: Partial<Settings> = {}): Settings {
  const scales = { ...defaultSettings.scales, ...raw.scales };
  const settings = { ...defaultSettings, ...raw, scales };
  return {
    ...settings,
    sleepRedMin:
      raw.sleepRedMin ??
      Math.min(defaultSettings.sleepRedMin, settings.sleepMin),
    painRedMin:
      raw.painRedMin ?? Math.max(defaultSettings.painRedMin, settings.painMin),
    loadRedMax:
      raw.loadRedMax ??
      Math.min(
        6000,
        Math.max(defaultSettings.loadRedMax, settings.loadMax + 250),
      ),
    fatigueRed:
      raw.fatigueRed ??
      (scales.fatigue.direction === "higher_better"
        ? scales.fatigue.min
        : scales.fatigue.max),
  };
}
