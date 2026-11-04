import { serverSupabase } from "./supabase";
import { normalizeSettings } from "./settings";
import type { Dataset, Viewer } from "./types";
export async function loadData(): Promise<{
  data: Dataset;
  viewer: Viewer;
} | null> {
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const profile = await db
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profile.error)
    throw new Error(
      "Your account has not been assigned an organization and role.",
    );
  const tables = [
    "athletes",
    "teams",
    "team_memberships",
    "sessions",
    "athlete_sessions",
    "wellness_responses",
    "pain_records",
    "organizations",
  ];
  const results = await Promise.all(
    tables.map(async (table) => {
      let all: any[] = [];
      const keys =
        table === "team_memberships"
          ? ["athlete_id", "team_id"]
          : table === "athlete_sessions"
            ? ["athlete_id", "session_id"]
            : ["id"];
      for (let page = 0; ; page++) {
        let query = db.from(table).select("*");
        for (const key of keys) query = query.order(key);
        const result = await query.range(page * 1000, page * 1000 + 999);
        if (result.error) return result;
        all = all.concat(result.data);
        if (result.data.length < 1000) return { data: all, error: null };
      }
    }),
  );
  for (const r of results)
    if (r.error)
      throw new Error("Unable to load authorized data: " + r.error.message);
  const [athletes, teams, memberships, sessions, entries, wellness, pain, org] =
    results.map((r) => r.data ?? []);
  return {
    viewer: {
      id: user.id,
      role: profile.data.role,
      name: profile.data.name,
      athlete_id: athletes.find((a) => a.user_id === user.id)?.id,
    },
    data: {
      organization: org[0] ? { id: org[0].id, name: org[0].name } : undefined,
      athletes: athletes.map((a) => ({
        ...a,
        team_ids: memberships
          .filter((m) => m.athlete_id === a.id)
          .map((m) => m.team_id),
        team_id: memberships.find((m) => m.athlete_id === a.id)?.team_id ?? "",
        avatar: "#e5e9df",
      })),
      teams,
      sessions: sessions.map((s) => ({
        ...s,
        athlete_ids: entries
          .filter((e) => e.session_id === s.id)
          .map((e) => e.athlete_id),
      })),
      entries,
      wellness,
      pain,
      settings: normalizeSettings(org[0]?.settings ?? {}),
    },
  };
}
