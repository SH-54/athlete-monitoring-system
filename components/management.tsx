"use client";
import { useEffect, useState } from "react";
import Invitations from "./invitations";
import { Plus, ShieldCheck, Users } from "lucide-react";
import type { Dataset, Role } from "@/lib/types";
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
  locale: string;
  notify: (v: string) => void;
  onUpdate: React.Dispatch<React.SetStateAction<Dataset>>;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]),
    [permissions, setPermissions] = useState<Permission[]>([]),
    [audit, setAudit] = useState<Audit[]>([]),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(""),
    [permissionUser, setPermissionUser] = useState("");
  const zh = locale === "zh",
    ja = locale === "ja";
  const label = (c: string, j: string, e: string) => (zh ? c : ja ? j : e);
  async function refresh() {
    const r = await fetch("/api/manage");
    if (!r.ok) throw new Error("Unable to load management data");
    const j = await r.json();
    setProfiles(j.profiles);
    setPermissions(j.permissions);
    setAudit(j.audit);
  }
  useEffect(() => {
    if (!demo) refresh().catch((e) => notify(e.message));
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
        if (!r.ok) throw new Error((await r.json()).error);
        if (value.kind === "team" || value.kind === "athlete") {
          location.reload();
          return;
        }
        await refresh();
      }
      notify(label("已保存", "保存しました", "Saved"));
    } catch (e) {
      notify(e instanceof Error ? e.message : "Save failed");
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
            <Users size={18} /> {label("球队管理", "チーム管理", "Teams")}
          </h2>
        </div>
        <div className="managed-teams">
          {data.teams.map((team) => (
            <div key={team.id}>
              <strong>{team.name}</strong>
              <span>
                {data.athletes.filter((a) => a.team_id === team.id).length}{" "}
                {label("人", "名", "athletes")}
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
            {label("新球队名称", "新しいチーム名", "New team name")}
            <input name="name" required maxLength={100} />
          </label>
          <button className="secondary" disabled={busy}>
            <Plus size={15} />
            {label("添加球队", "チーム追加", "Add team")}
          </button>
        </form>
      </section>
      <section className="panel settings-panel">
        <h2>{label("选手管理", "選手管理", "Athlete management")}</h2>
        <label>
          {label("编辑或新增", "編集・新規作成", "Edit or create")}
          <select value={editing} onChange={(e) => setEditing(e.target.value)}>
            <option value="">
              + {label("新增球员", "選手追加", "New athlete")}
            </option>
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
              {label("姓名", "名前", "Name")}
              <input
                name="name"
                defaultValue={athlete?.name}
                required
                maxLength={100}
              />
            </label>
            <label>
              {label("号码", "背番号", "Number")}
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
              {label("位置", "ポジション", "Position")}
              <select name="position" defaultValue={athlete?.position ?? "MF"}>
                {["GK", "DF", "MF", "FW"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              {label("球队", "チーム", "Team")}
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
            Auth User UUID ({label("可选", "任意", "optional")})
            <input
              name="user_id"
              defaultValue={athlete?.user_id}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <small className="muted">
            {label(
              "球队选择将添加成员关系，已有历史关系会保留。",
              "チーム選択で所属を追加し、過去の所属は維持します。",
              "Team selection adds membership; existing memberships are retained.",
            )}
          </small>
          <button className="primary" disabled={busy}>
            {label("保存球员", "選手を保存", "Save athlete")}
          </button>
        </form>
      </section>
      <section className="panel settings-panel">
        <h2>
          <ShieldCheck size={18} />{" "}
          {label("账户与权限", "アカウントと権限", "Accounts & roles")}
        </h2>
        <p className="muted">
          {label(
            "先在 Supabase Auth 中邀请账户，再填写其 UUID。不会在浏览器中创建或存储密码。",
            "Supabase Authでアカウントを招待した後、そのUUIDを登録します。ブラウザーでパスワードを管理しません。",
            "Invite the account in Supabase Auth first, then register its UUID here. Passwords are managed by Supabase Auth.",
          )}
        </p>
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
            Auth User UUID
            <input name="id" required pattern="[0-9a-fA-F-]{36}" />
          </label>
          <div className="form-grid">
            <label>
              {label("姓名", "名前", "Name")}
              <input name="name" required maxLength={100} />
            </label>
            <label>
              {label("权限", "権限", "Role")}
              <select name="role">
                <option value="athlete">Athlete</option>
                <option value="coach">Coach</option>
                <option value="medical">Medical Staff</option>
                <option value="administrator">Administrator</option>
              </select>
            </label>
          </div>
          <button className="secondary" disabled={busy}>
            {label("保存账户", "アカウント保存", "Save account")}
          </button>
        </form>
        <div className="managed-teams">
          {profiles.map((p) => (
            <div key={p.id}>
              <strong>{p.name}</strong>
              <span>{p.role}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel settings-panel">
        <h2>{label("工作人员授权", "スタッフ権限", "Staff permissions")}</h2>
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
            {label("工作人员", "スタッフ", "Staff member")}
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
                    {p.name} · {p.role}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {label("授权范围", "許可範囲", "Scope")}
            <select key={permissionUser} name="scope" required>
              {data.teams.map((t) => (
                <option key={t.id} value={`team:${t.id}`}>
                  Team · {t.name}
                </option>
              ))}
              {profiles.find((p) => p.id === permissionUser)?.role ===
                "medical" &&
                data.athletes.map((a) => (
                  <option key={a.id} value={`athlete:${a.id}`}>
                    Athlete · {a.name}
                  </option>
                ))}
            </select>
          </label>
          <button className="secondary" disabled={busy}>
            {label("授予权限", "権限を追加", "Grant access")}
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
                {label("撤销", "解除", "Revoke")}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="panel settings-panel audit-panel">
        <h2>
          {label(
            "操作记录（最近100条）",
            "操作履歴（最新100件）",
            "Audit log (latest 100)",
          )}
        </h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Table</th>
                <th>Operation</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                  <td>{a.table_name}</td>
                  <td>{a.operation}</td>
                  <td>
                    {profiles.find((p) => p.id === a.actor_id)?.name ??
                      a.actor_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!audit.length && (
          <p className="muted">
            {label("暂无记录", "記録なし", "No audit entries")}
          </p>
        )}
      </section>
    </div>
  );
}
