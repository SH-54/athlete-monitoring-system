"use client";
import { useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import type { Dataset, Role } from "@/lib/types";
import { useLanguage } from "./language-provider";
import { roleLabel } from "@/lib/i18n";
type Invite = {
  id: string;
  email: string;
  name: string;
  role: Role;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};
export default function Invitations({
  data,
  demo,
  notify,
}: {
  data: Dataset;
  demo: boolean;
  notify: (s: string) => void;
}) {
  const { t } = useLanguage();
  const [invites, setInvites] = useState<Invite[]>([]),
    [role, setRole] = useState<Role>("athlete"),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await fetch("/api/invitations");
    const j = await r.json();
    if (!r.ok) throw new Error(t.inviteLoadError);
    setInvites(j.invitations);
  }
  useEffect(() => {
    if (!demo) refresh().catch(() => notify(t.inviteLoadError));
  }, [demo]);
  return (
    <section className="panel settings-panel invitations-panel">
      <div className="panel-heading">
        <h2>
          <Link2 size={18} /> {t.inviteTitle}
        </h2>
        <span className="pill neutral">{t.inviteExpiry}</span>
      </div>
      <p className="muted">{t.inviteHelp}</p>
      {demo ? (
        <p className="setup-note">{t.inviteDemo}</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setLink("");
            const f = new FormData(e.currentTarget);
            try {
              const r = await fetch("/api/invitations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: String(f.get("email")),
                  name: String(f.get("name")),
                  role,
                  team_id:
                    role === "coach" || role === "medical"
                      ? String(f.get("team"))
                      : null,
                  athlete_id:
                    role === "athlete" ? String(f.get("athlete")) : null,
                }),
              });
              const j = await r.json();
              if (!r.ok) throw new Error(t.inviteError);
              setLink(location.origin + "/join?token=" + j.token);
              await refresh();
              notify(t.inviteCreated);
            } catch (e) {
              notify(t.inviteError);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              {t.manageName}
              <input name="name" maxLength={100} required />
            </label>
            <label>
              {t.inviteEmail}
              <input name="email" type="email" maxLength={254} required />
            </label>
            <label>
              {t.role}
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="athlete">{t.athlete}</option>
                <option value="coach">{t.roleCoach}</option>
                <option value="medical">{t.roleMedical}</option>
                <option value="administrator">{t.roleAdministrator}</option>
              </select>
            </label>
            {role === "athlete" ? (
              <label>
                {t.athleteRecord}
                <select name="athlete" required>
                  <option value="">{t.choose}</option>
                  {data.athletes
                    .filter((a) => !a.user_id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        #{a.number} {a.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : role !== "administrator" ? (
              <label>
                {t.assignedTeam}
                <select name="team" required>
                  <option value="">{t.choose}</option>
                  {data.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <button className="primary" disabled={busy}>
            {t.issueInvite}
          </button>
        </form>
      )}
      {link && (
        <div className="invite-link">
          <label>
            {t.inviteLink}
            <input readOnly value={link} />
          </label>
          <button
            className="secondary"
            onClick={() =>
              navigator.clipboard
                .writeText(link)
                .then(() => notify(t.copied))
                .catch(() => notify(t.copyHelp))
            }
          >
            <Copy size={16} />
            {t.copy}
          </button>
        </div>
      )}
      {invites.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.manageName}</th>
                <th>{t.email}</th>
                <th>{t.role}</th>
                <th>{t.status}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{i.email}</td>
                  <td>{roleLabel(i.role, t)}</td>
                  <td>
                    {i.accepted_at
                      ? t.inviteAccepted
                      : i.revoked_at
                        ? t.inviteRevoked
                        : new Date(i.expires_at) < new Date()
                          ? t.inviteExpired
                          : t.invitePending}
                  </td>
                  <td>
                    {!i.accepted_at && !i.revoked_at && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const r = await fetch("/api/invitations", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: i.id }),
                            });
                            if (!r.ok) throw new Error(t.inviteRevokeError);
                            setLink("");
                            await refresh();
                          } catch (e) {
                            notify(t.inviteRevokeError);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {t.revokeInvite}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
