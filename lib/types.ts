export type Role = "administrator" | "coach" | "medical" | "athlete";
export type Locale = "zh" | "ja" | "en";
export type Attendance =
  | "pending"
  | "attended"
  | "rest"
  | "rehabilitation"
  | "absent"
  | "not_participating";
export type Athlete = {
  id: string;
  user_id?: string;
  name: string;
  number: number;
  position: string;
  team_id: string;
  team_ids?: string[];
  avatar: string;
};
export type Session = {
  id: string;
  code: string;
  date: string;
  team_id: string;
  type: string;
  start_time: string;
  end_time: string;
  duration: number;
  athlete_ids: string[];
};
export type Wellness = {
  athlete_id: string;
  date: string;
  sleep_hours: number;
  sleep_quality: number;
  fatigue: number;
  soreness: number;
  stress: number;
  appetite: number;
  weight: number;
  comment: string;
};
export type Pain = {
  athlete_id: string;
  date: string;
  body_part: string;
  severity: number;
};
export type Entry = {
  athlete_id: string;
  session_id: string;
  status: Attendance;
  minutes: number;
  rpe: number | null;
};
export type Scale = {
  min: number;
  max: number;
  direction: "higher_better" | "higher_worse";
};
export type Settings = {
  sleepMin: number;
  sleepRedMin: number;
  fatigueMax: number;
  fatigueRed: number;
  painMin: number;
  painRedMin: number;
  weightChangePct: number;
  loadMax: number;
  loadRedMax: number;
  loadSpikePct: number;
  sleepQualityDrop: number;
  newPainMin: number;
  wellnessDeviation: number;
  acwr: "coupled" | "uncoupled" | "ewma";
  scales: Record<
    "sleep_quality" | "fatigue" | "soreness" | "stress" | "appetite",
    Scale
  >;
};
export type Dataset = {
  organization?: { id: string; name: string };
  athletes: Athlete[];
  sessions: Session[];
  wellness: Wellness[];
  pain: Pain[];
  entries: Entry[];
  teams: { id: string; name: string }[];
  settings: Settings;
};
export type Viewer = {
  id: string;
  role: Role;
  athlete_id?: string;
  name: string;
};
