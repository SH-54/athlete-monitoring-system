import { makeDemo } from "./demo";
import type { Dataset, Role, Viewer } from "./types";
export function demoView(role: Role): { data: Dataset; viewer: Viewer } {
  const data = makeDemo();
  const own = data.athletes[0];
  if (role !== "administrator") {
    const ids = new Set(
      data.athletes
        .filter((a) =>
          role === "athlete" ? a.id === own.id : a.team_id === own.team_id,
        )
        .map((a) => a.id),
    );
    data.athletes = data.athletes.filter((a) => ids.has(a.id));
    data.teams = data.teams.filter((t) => t.id === own.team_id);
    data.sessions = data.sessions
      .filter((s) => s.team_id === own.team_id)
      .map((s) => ({
        ...s,
        athlete_ids: s.athlete_ids.filter((id) => ids.has(id)),
      }));
    const sessions = new Set(data.sessions.map((s) => s.id));
    data.entries = data.entries.filter(
      (e) => ids.has(e.athlete_id) && sessions.has(e.session_id),
    );
    data.wellness = data.wellness.filter((w) => ids.has(w.athlete_id));
    data.pain = data.pain.filter((w) => ids.has(w.athlete_id));
  }
  return {
    data,
    viewer: {
      id: "demo-" + role,
      role,
      name:
        role === "athlete"
          ? own.name
          : role === "coach"
            ? "Demo Coach"
            : "Demo Administrator",
      ...(role === "athlete" ? { athlete_id: own.id } : {}),
    },
  };
}
