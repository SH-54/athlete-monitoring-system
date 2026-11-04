"use client";
import { useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import type { Dataset, Role } from "@/lib/types";
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
  const [invites, setInvites] = useState<Invite[]>([]),
    [role, setRole] = useState<Role>("athlete"),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await fetch("/api/invitations");
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    setInvites(j.invitations);
  }
  useEffect(() => {
    if (!demo) refresh().catch((e) => notify(e.message));
  }, [demo]);
  return (
    <section className="panel settings-panel invitations-panel">
      <div className="panel-heading">
        <h2>
          <Link2 size={18} /> 選手・スタッフを招待
        </h2>
        <span className="pill neutral">7日間有効</span>
      </div>
      <p className="muted">
        メールアドレスと役割を指定してリンクを発行し、本人に共有してください。選手レコードを先に作成しておけば、アカウントを持たずコーチが代理入力する選手も登録できます。
      </p>
      {demo ? (
        <p className="setup-note">
          デモでは招待を発行しません。Supabase接続後に利用できます。
        </p>
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
              if (!r.ok) throw new Error(j.error);
              setLink(location.origin + "/join?token=" + j.token);
              await refresh();
              notify("招待リンクを発行しました。ご本人に共有してください。");
            } catch (e) {
              notify(e instanceof Error ? e.message : "発行できませんでした");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              名前
              <input name="name" maxLength={100} required />
            </label>
            <label>
              招待先メールアドレス
              <input name="email" type="email" maxLength={254} required />
            </label>
            <label>
              役割
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="athlete">選手</option>
                <option value="coach">コーチングスタッフ</option>
                <option value="medical">メディカルスタッフ</option>
                <option value="administrator">管理者</option>
              </select>
            </label>
            {role === "athlete" ? (
              <label>
                本人の選手レコード
                <select name="athlete" required>
                  <option value="">選択してください</option>
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
                担当チーム
                <select name="team" required>
                  <option value="">選択してください</option>
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
            招待リンクを発行
          </button>
        </form>
      )}
      {link && (
        <div className="invite-link">
          <label>
            本人に共有するリンク（発行時のみ表示）
            <input readOnly value={link} />
          </label>
          <button
            className="secondary"
            onClick={() =>
              navigator.clipboard
                .writeText(link)
                .then(() => notify("コピーしました"))
                .catch(() => notify("リンク欄を選択してコピーしてください。"))
            }
          >
            <Copy size={16} />
            コピー
          </button>
        </div>
      )}
      {invites.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>名前</th>
                <th>メール</th>
                <th>役割</th>
                <th>状態</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{i.email}</td>
                  <td>{i.role}</td>
                  <td>
                    {i.accepted_at
                      ? "参加済み"
                      : i.revoked_at
                        ? "取消済み"
                        : new Date(i.expires_at) < new Date()
                          ? "期限切れ"
                          : "未参加"}
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
                            if (!r.ok) throw new Error("取り消せませんでした");
                            setLink("");
                            await refresh();
                          } catch (e) {
                            notify(
                              e instanceof Error ? e.message : "失敗しました",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        招待を取り消す
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
