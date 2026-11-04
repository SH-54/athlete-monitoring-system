import { shiftDate, isoDate } from "./analytics";
import type { Dataset, Settings } from "./types";
export const defaultSettings: Settings = {
  sleepMin: 7,
  sleepRedMin: 5,
  fatigueMax: 4,
  fatigueRed: 5,
  painMin: 3,
  painRedMin: 5,
  weightChangePct: 2,
  loadMax: 750,
  loadRedMax: 1000,
  loadSpikePct: 50,
  sleepQualityDrop: 1.5,
  newPainMin: 1,
  wellnessDeviation: 1.5,
  acwr: "coupled",
  scales: {
    sleep_quality: { min: 1, max: 5, direction: "higher_better" },
    fatigue: { min: 1, max: 5, direction: "higher_worse" },
    soreness: { min: 1, max: 5, direction: "higher_worse" },
    stress: { min: 1, max: 5, direction: "higher_worse" },
    appetite: { min: 1, max: 5, direction: "higher_better" },
  },
};
export function makeDemo(): Dataset {
  const date = isoDate(new Date());
  const names = [
    "陈宇航",
    "王子轩",
    "李明远",
    "张皓然",
    "刘奕辰",
    "赵梓豪",
    "黄俊熙",
    "周睿泽",
    "吴承宇",
    "徐嘉佑",
    "孙浩宇",
    "马昊天",
    "朱泽楷",
    "胡景行",
    "郭亦凡",
    "林逸飞",
    "何一鸣",
    "高卓然",
    "罗天佑",
    "郑思远",
  ];
  const data: Dataset = {
    athletes: names.map((name, i) => ({
      id: `demo-${i + 1}`,
      name,
      number: [
        1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 19, 20, 21, 23, 25, 30,
      ][i],
      position: ["GK", "DF", "DF", "DF", "MF", "FW", "MF", "FW", "MF", "FW"][
        i % 10
      ],
      team_id: i < 16 ? "first" : "u21",
      avatar: ["#e9e4d9", "#e1e9e4", "#e4e3eb", "#f0e3dc"][i % 4],
    })),
    teams: [
      { id: "first", name: "一线队" },
      { id: "u21", name: "U21 梯队" },
    ],
    sessions: [],
    wellness: [],
    pain: [],
    entries: [],
    settings: structuredClone(defaultSettings),
  };
  for (let day = -41; day <= 0; day++) {
    const d = shiftDate(date, day);
    const rest = day !== 0 && new Date(d + "T12:00:00Z").getUTCDay() === 0;
    for (const [teamIndex, team] of data.teams.entries()) {
      const roster = data.athletes.filter((a) => a.team_id === team.id);
      for (let k = 0; k < (rest ? 1 : day === 0 ? 3 : 2); k++) {
        const id = `session-${day}-${team.id}-${k}`;
        const duration = rest ? 0 : [70, 50, 30][k];
        data.sessions.push({
          id,
          code: `TR${String((day + 42) * 6 + teamIndex * 3 + k).padStart(3, "0")}`,
          date: d,
          team_id: team.id,
          type: rest ? "Other" : ["Field", "Gym", "Rehabilitation"][k],
          start_time: ["09:00", "15:00", "17:00"][k],
          end_time: ["10:10", "15:50", "17:30"][k],
          duration,
          athlete_ids: roster.map((a) => a.id),
        });
        roster.forEach((a) => {
          const i = data.athletes.findIndex((x) => x.id === a.id);
          const pending = day === 0 && (i === 5 || i === 10 || i === 17);
          data.entries.push({
            athlete_id: a.id,
            session_id: id,
            status: rest
              ? "rest"
              : pending
                ? "pending"
                : i === 12
                  ? "rehabilitation"
                  : i === 18
                    ? "absent"
                    : "attended",
            minutes: duration,
            rpe:
              pending || rest || i === 18 ? null : 3 + ((i + day + 42 + k) % 5),
          });
        });
      }
    }
    data.athletes.forEach((a, i) => {
      if (day === 0 && (i === 5 || i === 17)) return;
      data.wellness.push({
        athlete_id: a.id,
        date: d,
        sleep_hours: i === 2 ? 5.5 : i === 8 ? 6 : 7 + (i % 4) * 0.5,
        sleep_quality: 3 + (i % 3),
        fatigue: i === 2 || i === 8 ? 4 : 1 + (i % 3),
        soreness: i === 3 ? 4 : 1 + (i % 3),
        stress: 1 + (i % 3),
        appetite: 3 + (i % 3),
        weight: 65 + i * 1.1,
        comment: i === 2 ? "昨晚睡眠不足，右膝有轻微不适。" : "",
      });
    });
  }
  data.pain = [
    { athlete_id: "demo-3", date, body_part: "右膝", severity: 6 },
    { athlete_id: "demo-9", date, body_part: "左踝", severity: 3 },
    { athlete_id: "demo-13", date, body_part: "大腿后侧", severity: 2 },
  ];
  return data;
}
