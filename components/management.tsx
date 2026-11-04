"use client";
import { useEffect, useState } from "react";
import { dictionaries, roleLabel } from "@/lib/i18n";
import { useLanguage } from "./language-provider";
import Invitations from "./invitations";
import { Plus, ShieldCheck, Users } from "lucide-react";
import type { Dataset, Role, Locale } from "@/lib/types";
type Profile = { id: string; name: string; role: Role };
type Permission = {
  id: string;
  user_id: string;
  team_id: string | null;
  athlete_id: string | null;
};
type Audit = {
  id: number;
  table_name: string;
  operation: string;
  actor_id: string;
  created_at: string;
};
export default function Management({
  data,
  demo,
  locale,
  notify,
  onUpdate,
}: {
  data: Dataset;
  demo: boolean;
  locale: Locale;
  notify: (v: string) => void;
  onUpdate: React.Dispatch<React.SetStateAction<Dataset>>;
}) {
  const { intlLocale } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]),
    [permissions, setPermissions] = useState<Permission[]>([]),
    [audit, setAudit] = useState<Audit[]>([]),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(""),
    [permissionUser, setPermissionUser] = useState("");
  const t = dictionaries[locale];
  async function refresh() {
    const r = await fetch("/api/manage");
    if (!r.ok) throw new Error(t.manageLoadError);
    const j = await r.json();
    setProfiles(j.profiles);
    setPermissions(j.permissions);
    setAudit(j.audit);
  }
  useEffect(() => {
    if (!demo) refresh().catch(() => notify(t.manageLoadError));
  }, [demo]);
  async function save(value: Record<string, unknown>) {
    setBusy(true);
    try {
      if (demo) {
        if (value.kind === "team")
          onUpdate((d) => ({
            ...d,
            teams: [
              ...d.teams,
              { id: crypto.randomUUID(), name: String(value.name) },
            ],
          }));
        if (value.kind === "athlete")
          onUpdate((d) => ({
            ...d,
            athletes: value.id
              ? d.athletes.map((a) =>
                  a.id === value.id ? ({ ...a, ...value } as typeof a) : a,
                )
              : [
                  ...d.athletes,
                  {
                    ...value,
                    id: crypto.randomUUID(),
                    avatar: "#e5eadf",
                  } as Dataset["athletes"][number],
                ],
          }));
        if (value.kind === "profile")
          setProfiles((x) => [
            ...x.filter((p) => p.id !== value.id),
            value as unknown as Profile,
          ]);
        if (value.kind === "permission")
          setPermissions((x) => [
            ...x,
            { ...value, id: crypto.randomUUID() } as Permission,
          ]);
        if (value.kind === "revoke")
          setPermissions((x) => x.filter((p) => p.id !== value.id));
      } else {
        const r = await fetch("/api/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        });
        if (!r.ok) throw new Error(t.saveError);
        if (value.kind === "team" || value.kind === "athlete") {
          location.reload();
          return;
        }
        await refresh();
      }
      notify(t.manageSaved);
    } catch (e) {
      notify(t.saveError);
    } finally {
      setBusy(false);
    }
  }
  const athlete = data.athletes.find((a) => a.id === editing);
  return (
    <div className="management-grid">
      <Invitations data={data} demo={demo} notify={notify} />
      <section className="panel settings-panel">
        <div className="panel-heading">
          <h2>
            <Users size={18} /> {t.manageTeams}
          </h2>
        </div>
        <div className="managed-teams">
          {data.teams.map((team) => (
            <div key={team.id}>
              <strong>{team.name}</strong>
              <span>
                {data.athletes.filter((a) => a.team_id === team.id).length}{" "}
                {t.results}
              </span>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save({ kind: "team", name: String(f.get("name")) });
          }}
        >
          <label>
            {t.manageNewTeamName}
            <input name="name" required maxLength={100} />
          </label>
          <button className="secondary" disabled={busy}>
            <Plus size={15} />
            {t.manageAddTeam}
          </button>
        </form>
      </section>
      <section className="panel settings-panel">
        <h2>{t.manageAthleteManagement}</h2>
        <label>
          {t.manageEditOrCreate}
          <select value={editing} onChange={(e) => setEditing(e.target.value)}>
            <option value="">+ {t.manageNewAthlete}</option>
            {data.athletes.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <form
          key={editing}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save({
              kind: "athlete",
              ...(editing ? { id: editing } : {}),
              name: String(f.get("name")),
              number: Number(f.get("number")),
              position: String(f.get("position")),
              team_id: String(f.get("team_id")),
              user_id: String(f.get("user_id")),
            });
          }}
        >
          <div className="form-grid">
            <label>
              {t.manageName}
              <input
                name="name"
                defaultValue={athlete?.name}
                required
                maxLength={100}
              />
            </label>
            <label>
              {t.manageNumber}
              <input
                name="number"
                type="number"
                min={0}
                max={999}
                defaultValue={athlete?.number}
                required
              />
            </label>
            <label>
              {t.managePosition}
              <select name="position" defaultValue={athlete?.position ?? "MF"}>
                {["GK", "DF", "MF", "FW"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              {t.team}
              <select name="team_id" defaultValue={athlete?.team_id}>
                {data.teams.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {t.authUserId} ({t.manageOptional})
            <input
              name="user_id"
              defaultValue={athlete?.user_id}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <small className="muted">{t.membershipHelp}</small>
          <button className="primary" disabled={busy}>
            {t.manageSaveAthlete}
          </button>
        </form>
      </section>
      <section className="panel settings-panel">
        <h2>
          <ShieldCheck size={18} /> {t.manageAccountsRoles}
        </h2>
        <p className="muted">{t.advancedAccountsHelp}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save({
              kind: "profile",
              id: String(f.get("id")),
              name: String(f.get("name")),
              role: String(f.get("role")),
            });
          }}
        >
          <label>
            {t.authUserId}
            <input name="id" required pattern="[0-9a-fA-F-]{36}" />
          </label>
          <div className="form-grid">
            <label>
              {t.manageName}
              <input name="name" required maxLength={100} />
            </label>
            <label>
              {t.role}
              <select name="role">
                <option value="athlete">{t.athlete}</option>
                <option value="coach">{t.roleCoach}</option>
                <option value="medical">{t.roleMedical}</option>
                <option value="administrator">{t.roleAdministrator}</option>
              </select>
            </label>
          </div>
          <button className="secondary" disabled={busy}>
            {t.manageSaveAccount}
          </button>
        </form>
        <div className="managed-teams">
          {profiles.map((p) => (
            <div key={p.id}>
              <strong>{p.name}</strong>
              <span>{roleLabel(p.role, t)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel settings-panel">
        <h2>{t.manageStaffPermissions}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              scope = String(f.get("scope"));
            save({
              kind: "permission",
              user_id: String(f.get("user_id")),
              team_id: scope.startsWith("team:") ? scope.slice(5) : null,
              athlete_id: scope.startsWith("athlete:") ? scope.slice(8) : null,
            });
          }}
        >
          <label>
            {t.manageStaffMember}
            <select
              name="user_id"
              required
              value={permissionUser}
              onChange={(e) => setPermissionUser(e.target.value)}
            >
              <option value="">—</option>
              {profiles
                .filter((p) => p.role === "coach" || p.role === "medical")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {roleLabel(p.role, t)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t.manageScope}
            <select key={permissionUser} name="scope" required>
              {data.teams.map((team) => (
                <option key={team.id} value={`team:${team.id}`}>
                  {t.team} · {team.name}
                </option>
              ))}
              {profiles.find((p) => p.id === permissionUser)?.role ===
                "medical" &&
                data.athletes.map((a) => (
                  <option key={a.id} value={`athlete:${a.id}`}>
                    {t.athlete} · {a.name}
                  </option>
                ))}
            </select>
          </label>
          <button className="secondary" disabled={busy}>
            {t.manageGrantAccess}
          </button>
        </form>
        <div className="managed-teams">
          {permissions.map((p) => (
            <div key={p.id}>
              <strong>
                {profiles.find((x) => x.id === p.user_id)?.name}
                <small>
                  {p.team_id
                    ? data.teams.find((t) => t.id === p.team_id)?.name
                    : data.athletes.find((a) => a.id === p.athlete_id)?.name}
                </small>
              </strong>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => save({ kind: "revoke", id: p.id })}
              >
                {t.manageRevoke}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="panel settings-panel audit-panel">
        <h2>{t.manageAuditLogLatest100}</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.time}</th>
                <th>{t.auditTable}</th>
                <th>{t.operation}</th>
                <th>{t.actor}</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString(intlLocale)}</td>
                  <td>{a.table_name}</td>
                  <td>
                    {{
                      INSERT: t.auditInsert,
                      UPDATE: t.auditUpdate,
                      DELETE: t.auditDelete,
                    }[a.operation] ?? a.operation}
                  </td>
                  <td>
                    {profiles.find((p) => p.id === a.actor_id)?.name ??
                      a.actor_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!audit.length && <p className="muted">{t.manageNoAuditEntries}</p>}
      </section>
    </div>
  );
}
