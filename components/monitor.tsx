"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import Management from "./management";
import Importer from "./importer";
import { downloadSessionTemplate } from "@/lib/session-template";
import {
  Upload,
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  Sun,
  TrendingUp,
  Users,
  X,
  TriangleAlert,
  CheckCircle2,
  MoreHorizontal,
  Globe,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import dynamic from "next/dynamic";
import type {
  Athlete,
  Dataset,
  Entry,
  Locale,
  Session,
  Settings,
  Viewer,
  Wellness,
} from "@/lib/types";
import { dictionaries } from "@/lib/i18n";
import {
  alerts,
  dailyLoad,
  flagLevel,
  loadFlag,
  thresholdErrors,
  isoDate,
  loadMetrics,
  periodLoad,
  shiftDate,
} from "@/lib/analytics";
const Charts = dynamic(() => import("./charts"), {
  ssr: false,
  loading: () => <div className="panel chart">Loading charts…</div>,
});
type View =
  | "report"
  | "overview"
  | "players"
  | "sessions"
  | "input"
  | "medical"
  | "settings";
const icons = {
  report: ClipboardList,
  overview: LayoutDashboard,
  players: Users,
  sessions: CalendarDays,
  input: Heart,
  medical: Stethoscope,
  settings: Settings2,
};
const number = (n: number | null, digits = 0) =>
  n === null
    ? "—"
    : n.toLocaleString(undefined, { maximumFractionDigits: digits });
export default function Monitor({
  initialData,
  demo,
  viewer,
}: {
  initialData: Dataset;
  demo: boolean;
  viewer: Viewer;
}) {
  const [data, applyData] = useState(initialData),
    [locale, setLocale] = useState<Locale>("zh"),
    [localeReady, setLocaleReady] = useState(false),
    [view, setView] = useState<View>(
      viewer.role === "athlete" ? "input" : "report",
    ),
    [date, setDate] = useState(isoDate(new Date())),
    [team, setTeam] = useState("all"),
    [position, setPosition] = useState("all"),
    [alertFilter, setAlertFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [mode, setMode] = useState<"daily" | "session">("daily"),
    [sort, setSort] = useState<"number" | "name" | "load">("number"),
    [descending, setDescending] = useState(false),
    [selected, setSelected] = useState<Athlete | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [importSessionId, setImportSessionId] = useState<string | undefined>(),
    [modal, setModal] = useState<"session" | null>(null),
    [editingSession, setEditingSession] = useState<Session | undefined>(),
    [exportOpen, setExportOpen] = useState(false),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(""),
    [chartAthlete, setChartAthlete] = useState("all"),
    [from, setFrom] = useState(shiftDate(date, -6)),
    [to, setTo] = useState(date);
  const revision = useRef(0);
  const setData: Update = (next) => {
    revision.current++;
    applyData(next);
  };
  const [syncFailed, setSyncFailed] = useState(false);
  useEffect(() => {
    if (demo) return;
    let active = true;
    let pending: AbortController | null = null;
    async function sync() {
      if (document.hidden || pending) return;
      const generation = revision.current;
      pending = new AbortController();
      try {
        const r = await fetch("/api/dataset", {
          cache: "no-store",
          signal: pending.signal,
        });
        if (r.status === 401) {
          location.reload();
          return;
        }
        if (!r.ok) throw new Error();
        const j = await r.json();
        if (active) {
          if (j.viewer.role !== viewer.role) {
            location.reload();
            return;
          }
          if (revision.current === generation) applyData(j.data);
          setSyncFailed(false);
        }
      } catch (e) {
        if (active && !(e instanceof Error && e.name === "AbortError"))
          setSyncFailed(true);
      } finally {
        pending = null;
      }
    }
    const interval = setInterval(sync, 60000);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("athlos-refresh", sync);
    return () => {
      active = false;
      pending?.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("athlos-refresh", sync);
    };
  }, [demo, viewer.id, viewer.role]);
  const t = dictionaries[locale];
  const medical = viewer.role === "administrator" || viewer.role === "medical";
  const canSeePain = medical || viewer.role === "coach";
  const staff = viewer.role === "administrator" || viewer.role === "coach";
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`athlos-locale:${viewer.id}`);
      if (stored && ["zh", "ja", "en"].includes(stored))
        setLocale(stored as Locale);
    } catch {
      /* Some private browsers disable storage. */
    }
    setLocaleReady(true);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [viewer.id]);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
    if (localeReady) {
      try {
        localStorage.setItem(`athlos-locale:${viewer.id}`, locale);
      } catch {
        /* Preference storage is optional. */
      }
    }
  }, [locale, localeReady, viewer.id]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  const base = data.athletes.filter(
    (a) =>
      (team === "all" || (a.team_ids ?? [a.team_id]).includes(team)) &&
      (viewer.role !== "athlete" || a.id === viewer.athlete_id),
  );
  const filtered = useMemo(
    () =>
      base
        .filter(
          (a) =>
            (position === "all" || a.position === position) &&
            (!search ||
              a.name.toLowerCase().includes(search.toLowerCase()) ||
              String(a.number).includes(search)) &&
            (alertFilter === "all" ||
              (alertFilter === "flagged"
                ? alerts(data, a, date).length > 0
                : flagLevel(data, a, date) === alertFilter)),
        )
        .sort((a, b) => {
          const n =
            sort === "name"
              ? a.name.localeCompare(b.name)
              : sort === "load"
                ? (dailyLoad(data, a.id, date) ?? -1) -
                  (dailyLoad(data, b.id, date) ?? -1)
                : a.number - b.number;
          return descending ? -n : n;
        }),
    [base, position, search, alertFilter, data, date, sort, descending],
  );
  const morningCount = base.filter((a) =>
    data.wellness.some((w) => w.athlete_id === a.id && w.date === date),
  ).length;
  const assigned = (a: Athlete) =>
    data.sessions.filter(
      (s) => s.date === date && s.athlete_ids.includes(a.id),
    );
  const rpeDone = (a: Athlete) => {
    const s = assigned(a);
    return (
      !!s.length &&
      s.every((s) =>
        data.entries.some(
          (e) =>
            e.session_id === s.id &&
            e.athlete_id === a.id &&
            e.status !== "pending",
        ),
      )
    );
  };
  const rpeCount = base.filter(rpeDone).length;
  const flagged = base.filter((a) => alerts(data, a, date).length > 0);
  const known = base
    .map((a) => dailyLoad(data, a.id, date))
    .filter((x) => x !== null) as number[];
  const avg = known.length
    ? known.reduce((a, b) => a + b, 0) / known.length
    : null;
  const navs: View[] =
    viewer.role === "athlete"
      ? ["input", "players"]
      : viewer.role === "medical"
        ? ["report", "players", "medical"]
        : [
            "overview",
            "report",
            "players",
            "sessions",
            "input",
            ...(medical ? ["medical" as View] : []),
          ];
  function changeDate(d: string) {
    setDate(d);
    setFrom(shiftDate(d, -6));
    setTo(d);
  }
  function notify(s: string) {
    setToast(s);
  }
  async function send(path: string, payload: unknown) {
    const response = await fetch("/api/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const j = await response.json();
      throw new Error(j.error || t.saveError);
    }
  }
  function setViewTo(v: View) {
    setView(v);
    setSelected(null);
    setMobile(false);
  }
  function alertLabel(kind: string) {
    return (
      (
        {
          sleep: t.sleepAlert,
          fatigue: t.fatigueAlert,
          pain: t.painAlert,
          weight: t.weightAlert,
          load: t.loadAlert,
          baseline: t.baseline,
        } as Record<string, string>
      )[kind] ?? kind
    );
  }
  function reportRows() {
    return filtered.flatMap((a) => {
      const w = data.wellness.find(
          (w) => w.athlete_id === a.id && w.date === date,
        ),
        p = data.pain.filter((p) => p.athlete_id === a.id && p.date === date);
      const risk = flagLevel(data, a, date);
      const common = {
        date,
        number: a.number,
        name: a.name,
        position: a.position,
        wellness: w ? t.submitted : t.pending,
        sleep_hours: w?.sleep_hours ?? "",
        sleep_quality: w?.sleep_quality ?? "",
        fatigue: w?.fatigue ?? "",
        soreness: w?.soreness ?? "",
        pain: p.map((p) => `${p.body_part} ${p.severity}/10`).join("; "),
        weight: w?.weight ?? "",
        flag:
          risk === "red"
            ? t.redFlag
            : risk === "yellow"
              ? t.yellowFlag
              : risk === "missing"
                ? t.missingFlag
                : t.noFlag,
        alerts: alerts(data, a, date)
          .map((x) => `${alertLabel(x.kind)} (${x.value})`)
          .join("; "),
      };
      return mode === "daily"
        ? [
            {
              ...common,
              session: "TOTAL",
              minutes: assigned(a).reduce((n, s) => {
                const e = data.entries.find(
                  (e) => e.session_id === s.id && e.athlete_id === a.id,
                );
                return (
                  n +
                  (e && ["attended", "rehabilitation"].includes(e.status)
                    ? e.minutes
                    : 0)
                );
              }, 0),
              rpe: "",
              load: dailyLoad(data, a.id, date) ?? "",
              status: rpeDone(a) ? t.complete : t.pending,
            },
          ]
        : assigned(a).map((s) => {
            const e = data.entries.find(
              (e) => e.session_id === s.id && e.athlete_id === a.id,
            );
            return {
              ...common,
              session: s.code,
              minutes: e?.minutes ?? "",
              rpe: e?.rpe ?? "",
              load:
                e && ["attended", "rehabilitation"].includes(e.status)
                  ? e.minutes * (e.rpe ?? 0)
                  : e?.status === "pending"
                    ? ""
                    : 0,
              status: e ? t[e.status] : t.pending,
            };
          });
    });
  }
  async function exportReport(format: "csv" | "xlsx" | "pdf") {
    setExportOpen(false);
    if (format === "pdf") {
      window.print();
      return;
    }
    const rows = reportRows();
    if (!rows.length) {
      notify(t.noResults);
      return;
    }
    if (format === "xlsx") {
      const { createWorkbook } = await import("@/lib/export");
      const buffer = new Uint8Array(createWorkbook(rows)).buffer;
      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `athlos-${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const keys = Object.keys(rows[0]);
      const safe = (v: unknown) => {
        const s = String(v ?? "");
        return (
          '"' +
          (/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') +
          '"'
        );
      };
      const csv =
        "\uFEFF" +
        [
          keys.map(safe).join(","),
          ...rows.map((r) =>
            keys.map((k) => safe((r as Record<string, unknown>)[k])).join(","),
          ),
        ].join("\r\n");
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `athlos-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
  const stats = [
    {
      label: t.submission,
      value: base.length
        ? Math.round((morningCount / base.length) * 100) + "%"
        : "—",
      detail: `${morningCount} / ${base.length} ${t.submitted}`,
      icon: Sun,
      color: "green",
      progress: base.length ? morningCount / base.length : 0,
    },
    {
      label: t.rpeRate,
      value: base.length
        ? Math.round((rpeCount / base.length) * 100) + "%"
        : "—",
      detail: `${rpeCount} / ${base.length} ${t.complete}`,
      icon: CheckCheck,
      color: "blue",
      progress: base.length ? rpeCount / base.length : 0,
    },
    {
      label: t.teamLoad,
      value: number(avg),
      unit: "AU",
      detail: `${known.length} ${t.results} · ${t.daily}`,
      icon: Activity,
      color: "purple",
    },
    {
      label: t.alerts,
      value: String(flagged.length).padStart(2, "0"),
      unit: t.results,
      detail: flagged.length
        ? flagged
            .slice(0, 2)
            .map((a) => a.name)
            .join("、")
        : "—",
      icon: TriangleAlert,
      color: "amber",
    },
  ];
  return (
    <div className="app-shell" data-demo={demo ? "true" : "false"}>
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a className="brand" href="/" aria-label="ATHLOS home">
          <span className="brand-icon">A</span>ATHLOS
          <span className="brand-dot">®</span>
        </a>
        <div className="org-switch">
          <div className="club-icon">
            <ShieldCheck size={22} />
          </div>
          <div>
            <strong>{data.organization?.name ?? "ATHLOS FC"}</strong>
            <span>Performance department</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <p className="nav-label">{t.workspace}</p>
        <nav>
          {navs.map((v) => {
            const Icon = icons[v];
            return (
              <button
                key={v}
                className={view === v ? "active" : ""}
                onClick={() => setViewTo(v)}
              >
                <Icon size={19} />
                <span>{t[v]}</span>
                {v === "report" && (
                  <span className="nav-count">{base.length}</span>
                )}
              </button>
            );
          })}
        </nav>
        {viewer.role === "administrator" && (
          <>
            <p className="nav-label management">{t.management}</p>
            <nav>
              <button
                className={view === "settings" ? "active" : ""}
                onClick={() => setViewTo("settings")}
              >
                <Settings2 size={19} />
                {t.settings}
              </button>
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="sidebar-card">
            <div className="live-dot" />
            <span>PERFORMANCE, CONNECTED.</span>
            <p>
              Small insights.
              <br />
              Stronger together.
            </p>
            <Activity size={37} />
          </div>
          <div className="profile">
            <span className="profile-avatar">{viewer.name.slice(0, 1)}</span>
            <div>
              <strong>{viewer.name}</strong>
              <span>
                {viewer.role === "administrator"
                  ? "Administrator"
                  : viewer.role}
              </span>
            </div>
            {!demo && (
              <button
                aria-label={t.logout}
                className="icon-button"
                onClick={async () => {
                  await createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
                  ).auth.signOut();
                  location.reload();
                }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label={t.close}
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        {!demo && (
          <div
            className={`sync-bar ${syncFailed ? "failed" : ""}`}
            role={syncFailed ? "status" : undefined}
          >
            <span>
              {syncFailed
                ? "同期に失敗しました。表示中のデータは最新でない可能性があります。"
                : "60秒ごとにチームの記録を同期します。"}
            </span>
            <button
              onClick={() => window.dispatchEvent(new Event("athlos-refresh"))}
            >
              今すぐ更新
            </button>
          </div>
        )}
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Menu"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={22} />
            </button>
            <span>{t.workspace}</span>
            <ChevronRight size={13} />
            <strong>{t[view]}</strong>
          </div>
          <div className="top-actions">
            <span className="system-status">
              <span className="live-dot" />
              {demo ? "DEMO MODE" : "CONNECTED"}
            </span>
            <Globe size={16} />
            <select
              aria-label="Language"
              disabled={!localeReady}
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              <option value="zh">简体中文</option>
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
            <span className="top-divider" />
            <button
              className="icon-button notification"
              aria-label={t.notification}
              onClick={() => {
                setAlertFilter("flagged");
                setViewTo("report");
              }}
            >
              <Bell size={19} />
              {flagged.length > 0 && <i />}
            </button>
            <span className="top-avatar">{viewer.name.slice(0, 1)}</span>
          </div>
        </header>
        <main className="content">
          <div className="heading-row">
            <div>
              <div className="eyebrow page-eyebrow">
                <span />
                ATHLETE MONITORING <span className="slash">/</span>{" "}
                {selected
                  ? "ATHLETE PROFILE"
                  : view === "report"
                    ? "DAILY SNAPSHOT"
                    : view.toUpperCase()}
              </div>
              <h1>
                {selected
                  ? selected.name
                  : view === "overview"
                    ? t.overviewTitle
                    : t[
                        view === "input"
                          ? "morning"
                          : view === "medical"
                            ? "medicalTitle"
                            : view === "report"
                              ? "title"
                              : view
                      ]}
              </h1>
              <p className="subtitle">
                {selected
                  ? `#${selected.number} · ${selected.position} · ${data.teams.find((x) => x.id === selected.team_id)?.name ?? ""}`
                  : view === "overview"
                    ? t.overviewSub
                    : t.subtitle}
              </p>
            </div>
            <div className="heading-actions">
              {selected ? (
                <button className="secondary" onClick={() => setSelected(null)}>
                  <ArrowLeft size={16} />
                  {t.back}
                </button>
              ) : (
                <>
                  {staff && (
                    <button
                      className="secondary"
                      onClick={() => {
                        setImportSessionId(undefined);
                        setImportOpen(true);
                      }}
                    >
                      <Upload size={16} />
                      {locale === "zh"
                        ? "批量导入"
                        : locale === "ja"
                          ? "一括取り込み"
                          : "Bulk import"}
                    </button>
                  )}
                  <div className="date-switch">
                    <button
                      aria-label="Previous day"
                      onClick={() => changeDate(shiftDate(date, -1))}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <CalendarDays size={16} />
                    <input
                      aria-label={t.date}
                      type="date"
                      value={date}
                      onChange={(e) =>
                        e.target.value && changeDate(e.target.value)
                      }
                    />
                    <button
                      aria-label="Next day"
                      onClick={() => changeDate(shiftDate(date, 1))}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="export-wrap">
                    <button
                      className="primary"
                      onClick={() => setExportOpen(!exportOpen)}
                    >
                      <ArrowDownToLine size={16} />
                      {t.export}
                      <ChevronDown size={13} />
                    </button>
                    {exportOpen && (
                      <div className="dropdown">
                        {(["csv", "xlsx", "pdf"] as const).map((f) => (
                          <button key={f} onClick={() => exportReport(f)}>
                            <FileText size={15} />
                            {f === "pdf" ? t.print : f.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          {demo && (
            <div className="demo-banner">
              <span>
                <span className="live-dot" />
                {t.demo}
              </span>
              <small>{t.demoNotice}</small>
            </div>
          )}
          {selected ? (
            <AthleteDetail
              athlete={selected}
              data={data}
              date={date}
              t={t}
              medical={canSeePain}
            />
          ) : (
            <>
              {["report", "overview"].includes(view) && (
                <div className="stats-grid">
                  {stats.map((s) => (
                    <article className="stat-card" key={s.label}>
                      <div className="stat-top">
                        <span>{s.label}</span>
                        <span className={`stat-icon ${s.color}`}>
                          <s.icon size={18} />
                        </span>
                      </div>
                      <div className="stat-number">
                        {s.value}
                        <span>{s.unit}</span>
                      </div>
                      <div className="stat-bottom">
                        <span>{s.detail}</span>
                        {s.progress !== undefined ? (
                          <div className={`progress ${s.color}`}>
                            <i style={{ width: `${s.progress * 100}%` }} />
                          </div>
                        ) : (
                          <ArrowUpRight size={15} />
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {view === "report" && (
                <>
                  <section className="panel report-panel">
                    <div className="report-heading">
                      <div>
                        <h2>
                          {t.athlete}
                          <span className="count">{filtered.length}</span>
                        </h2>
                        <p>
                          {date} · {t.daily} & {t.wellness}
                        </p>
                      </div>
                      <div className="segmented">
                        <button
                          className={mode === "daily" ? "active" : ""}
                          onClick={() => setMode("daily")}
                        >
                          <ClipboardList size={14} />
                          {t.daily}
                        </button>
                        <button
                          className={mode === "session" ? "active" : ""}
                          onClick={() => setMode("session")}
                        >
                          <Activity size={14} />
                          {t.bySession}
                        </button>
                      </div>
                    </div>
                    <div className="filter-bar">
                      <div className="search-field">
                        <Search size={16} />
                        <input
                          aria-label={t.search}
                          placeholder={t.search}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                          <button
                            className="icon-button"
                            aria-label={t.reset}
                            onClick={() => setSearch("")}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      <div className="filter-selects">
                        <select
                          aria-label={t.team}
                          value={team}
                          onChange={(e) => setTeam(e.target.value)}
                        >
                          <option value="all">{t.allTeams}</option>
                          {data.teams.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Position"
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                        >
                          <option value="all">{t.allPositions}</option>
                          {["GK", "DF", "MF", "FW"].map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                        <select
                          aria-label={t.status}
                          value={alertFilter}
                          onChange={(e) => setAlertFilter(e.target.value)}
                        >
                          <option value="all">{t.allAlerts}</option>
                          <option value="flagged">{t.flagged}</option>
                          <option value="red">{t.redFlag}</option>
                          <option value="yellow">{t.yellowFlag}</option>
                          <option value="normal">{t.noFlag}</option>
                          <option value="missing">{t.missingFlag}</option>
                        </select>
                        <button
                          className="filter-reset"
                          title={t.reset}
                          aria-label={t.reset}
                          onClick={() => {
                            setTeam("all");
                            setPosition("all");
                            setAlertFilter("all");
                            setSearch("");
                          }}
                        >
                          <SlidersHorizontal size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="table-scroll">
                      <table className="report-table">
                        <thead>
                          <tr>
                            <th className="athlete-column">
                              <button
                                onClick={() => {
                                  setSort(
                                    sort === "number" ? "name" : "number",
                                  );
                                  setDescending(false);
                                }}
                              >
                                {t.athlete}
                                <ChevronDown size={12} />
                              </button>
                            </th>
                            <th>{t.wellness}</th>
                            <th>{t.rpe}</th>
                            <th>
                              {t.sleep}
                              <span>h / {t.quality}</span>
                            </th>
                            <th>
                              {t.fatigue}
                              <span>
                                {data.settings.scales.fatigue.min}–
                                {data.settings.scales.fatigue.max}
                              </span>
                            </th>
                            <th>
                              {t.soreness}
                              <span>
                                {data.settings.scales.soreness.min}–
                                {data.settings.scales.soreness.max}
                              </span>
                            </th>
                            <th>{t.pain}</th>
                            <th>
                              {t.weight}
                              <span>kg</span>
                            </th>
                            <th>
                              {mode === "daily" ? t.participation : t.activity}
                            </th>
                            <th>
                              {t.minutes}
                              <span>min</span>
                            </th>
                            <th>
                              <button
                                onClick={() => {
                                  setSort("load");
                                  setDescending(
                                    sort === "load" ? !descending : true,
                                  );
                                }}
                              >
                                {mode === "daily" ? t.load : t.sessionLoad}
                                <ChevronDown size={12} />
                              </button>
                              <span>AU</span>
                            </th>
                            <th>{t.status}</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.flatMap((a) => {
                            const w = data.wellness.find(
                                (w) => w.athlete_id === a.id && w.date === date,
                              ),
                              pain = data.pain.filter(
                                (p) => p.athlete_id === a.id && p.date === date,
                              ),
                              aa = alerts(data, a, date),
                              sessions = assigned(a);
                            const es = sessions.map((s) =>
                              data.entries.find(
                                (e) =>
                                  e.athlete_id === a.id &&
                                  e.session_id === s.id,
                              ),
                            );
                            const minutes = es.reduce(
                              (n, e) =>
                                n +
                                (e &&
                                ["attended", "rehabilitation"].includes(
                                  e.status,
                                )
                                  ? e.minutes
                                  : 0),
                              0,
                            );
                            const rows =
                              mode === "daily"
                                ? [null]
                                : sessions.length
                                  ? sessions
                                  : [null];
                            return rows.map((s, j) => {
                              const e = s
                                ? data.entries.find(
                                    (e) =>
                                      e.athlete_id === a.id &&
                                      e.session_id === s.id,
                                  )
                                : null;
                              const load = s
                                ? e
                                  ? e.status === "pending"
                                    ? null
                                    : ["attended", "rehabilitation"].includes(
                                          e.status,
                                        )
                                      ? e.minutes * (e.rpe ?? 0)
                                      : 0
                                  : null
                                : dailyLoad(data, a.id, date);
                              const rowSubmitted = s
                                ? !!e && e.status !== "pending"
                                : rpeDone(a);
                              return (
                                <tr
                                  key={a.id + (s?.id ?? "daily")}
                                  className={
                                    aa.some((x) => x.level === "danger")
                                      ? "row-attention"
                                      : ""
                                  }
                                >
                                  <td>
                                    <button
                                      className="athlete-cell"
                                      onClick={() => setSelected(a)}
                                    >
                                      <span
                                        className="athlete-avatar"
                                        style={{ background: a.avatar }}
                                      >
                                        {a.name.slice(-2)}
                                      </span>
                                      <span>
                                        <strong>{a.name}</strong>
                                        <small>
                                          <b>
                                            #{String(a.number).padStart(2, "0")}
                                          </b>
                                          <i /> {a.position}
                                        </small>
                                      </span>
                                    </button>
                                  </td>
                                  <td>
                                    <span
                                      className={`submission ${w ? "yes" : "no"}`}
                                    >
                                      {w ? (
                                        <CheckCircle2 size={13} />
                                      ) : (
                                        <Clock3 size={13} />
                                      )}{" "}
                                      {w ? t.submitted : t.pending}
                                    </span>
                                  </td>
                                  <td>
                                    <span
                                      className={`submission ${rowSubmitted ? "yes" : "no"}`}
                                    >
                                      {rowSubmitted ? (
                                        <CheckCircle2 size={13} />
                                      ) : (
                                        <Clock3 size={13} />
                                      )}{" "}
                                      {rowSubmitted ? t.submitted : t.pending}
                                    </span>
                                  </td>
                                  <td>
                                    <strong
                                      className={
                                        w &&
                                        w.sleep_hours < data.settings.sleepMin
                                          ? "text-amber"
                                          : ""
                                      }
                                    >
                                      {w?.sleep_hours ?? "—"}
                                    </strong>
                                    <span className="cell-divider">/</span>
                                    <span className="muted">
                                      {w?.sleep_quality ?? "—"}
                                    </span>
                                  </td>
                                  <td>
                                    {w ? (
                                      <span
                                        className={`score ${aa.some((x) => x.kind === "fatigue") ? "warn" : ""}`}
                                      >
                                        {w.fatigue}
                                      </span>
                                    ) : (
                                      <span className="muted">—</span>
                                    )}
                                  </td>
                                  <td>
                                    {w ? (
                                      <span
                                        className={`score ${w.soreness >= 4 ? "warn" : ""}`}
                                      >
                                        {w.soreness}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td>
                                    {!canSeePain &&
                                    viewer.role !== "athlete" ? (
                                      <span
                                        className="muted"
                                        title={t.medicalRestricted}
                                      >
                                        —
                                      </span>
                                    ) : pain.length ? (
                                      <div className="pain-cell">
                                        {pain.map((p) => (
                                          <span key={p.body_part}>
                                            <span className="pain-dot" />
                                            {p.body_part}
                                            <b>{p.severity}/10</b>
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="muted">
                                        {w ? t.noPain : "—"}
                                      </span>
                                    )}
                                  </td>
                                  <td>{w ? number(w.weight, 1) : "—"}</td>
                                  <td>
                                    {s ? (
                                      <span className="session-code">
                                        {s.code}
                                        <small>
                                          {e?.rpe !== null &&
                                          e?.rpe !== undefined
                                            ? `RPE ${e.rpe}`
                                            : e
                                              ? t[e.status]
                                              : "—"}
                                        </small>
                                      </span>
                                    ) : (
                                      <span>
                                        {
                                          es.filter(
                                            (e) =>
                                              e &&
                                              [
                                                "attended",
                                                "rehabilitation",
                                              ].includes(e.status),
                                          ).length
                                        }
                                        <span className="muted">
                                          {" "}
                                          / {sessions.length}
                                        </span>
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {s
                                      ? e &&
                                        ["attended", "rehabilitation"].includes(
                                          e.status,
                                        )
                                        ? e.minutes
                                        : "—"
                                      : minutes || (load === 0 ? "0" : "—")}
                                  </td>
                                  <td>
                                    <div className="load-cell">
                                      <strong>{number(load)}</strong>
                                      <div className="load-track">
                                        <i
                                          className={
                                            s
                                              ? ""
                                              : loadFlag(
                                                    load,
                                                    data.settings,
                                                  ) === "red"
                                                ? "red"
                                                : loadFlag(
                                                      load,
                                                      data.settings,
                                                    ) === "yellow"
                                                  ? "high"
                                                  : ""
                                          }
                                          style={{
                                            width: `${Math.min(((load ?? 0) / 1000) * 100, 100)}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    {aa.length ? (
                                      <span
                                        className={`pill ${aa.some((x) => x.level === "danger") ? "danger" : "warning"}`}
                                        title={aa
                                          .map(
                                            (x) =>
                                              `${alertLabel(x.kind)}: ${x.value}`,
                                          )
                                          .join("\n")}
                                      >
                                        <span />
                                        {aa.some((x) => x.level === "danger")
                                          ? t.redFlag
                                          : t.yellowFlag}
                                        <b>{aa.length}</b>
                                      </span>
                                    ) : (
                                      <span
                                        className={`pill ${flagLevel(data, a, date) === "missing" ? "neutral" : "success"}`}
                                      >
                                        <span />
                                        {flagLevel(data, a, date) === "missing"
                                          ? t.missingFlag
                                          : t.noFlag}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <button
                                      aria-label={`${a.name} ${t.personal}`}
                                      className="icon-button row-arrow"
                                      onClick={() => setSelected(a)}
                                    >
                                      <ChevronRight size={16} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            });
                          })}
                        </tbody>
                      </table>
                      {!filtered.length && (
                        <div className="empty">
                          <Search size={30} />
                          <h3>{t.noResults}</h3>
                          <button
                            className="secondary"
                            onClick={() => {
                              setSearch("");
                              setPosition("all");
                              setAlertFilter("all");
                              setTeam("all");
                            }}
                          >
                            {t.reset}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="table-footer">
                      <span>
                        {t.total} <strong>{filtered.length}</strong> {t.results}
                      </span>
                      <span>
                        <span className="legend-dot green" />
                        {t.noFlag}
                        <span className="legend-dot amber" />
                        {t.yellowFlag}
                        <span className="legend-dot red" />
                        {t.redFlag}
                        <span className="legend-dot gray" />
                        {t.missingFlag}
                      </span>
                      <button
                        className="text-button"
                        onClick={() => changeDate(isoDate(new Date()))}
                      >
                        {t.today}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </section>
                  <div className="report-bottom">
                    <section className="panel attention-panel">
                      <div className="panel-heading">
                        <h3>
                          <TriangleAlert size={17} />
                          {t.alerts}
                          <span className="count amber">{flagged.length}</span>
                        </h3>
                        <button
                          className="text-button"
                          onClick={() =>
                            setAlertFilter(
                              alertFilter === "flagged" ? "all" : "flagged",
                            )
                          }
                        >
                          {t.viewAll}
                          <ArrowRight size={14} />
                        </button>
                      </div>
                      {flagged.slice(0, 3).map((a) => (
                        <button
                          key={a.id}
                          className="attention-item"
                          onClick={() => setSelected(a)}
                        >
                          <span
                            className="athlete-avatar"
                            style={{ background: a.avatar }}
                          >
                            {a.name.slice(-2)}
                          </span>
                          <div>
                            <strong>
                              {a.name}
                              <small>
                                #{a.number} · {a.position}
                              </small>
                            </strong>
                            <p>
                              {alerts(data, a, date)
                                .map((x) => `${alertLabel(x.kind)} ${x.value}`)
                                .join(" · ")}
                            </p>
                          </div>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                      {!flagged.length && (
                        <p className="empty-small">{t.healthy} ✓</p>
                      )}
                    </section>
                    <section className="panel today-panel">
                      <div className="panel-heading">
                        <h3>
                          <CalendarDays size={17} />
                          {t.sessions}
                        </h3>
                        {staff && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setEditingSession(undefined);
                              setModal("session");
                            }}
                          >
                            <Plus size={15} />
                            {t.addSession}
                          </button>
                        )}
                      </div>
                      {data.sessions
                        .filter(
                          (s) =>
                            s.date === date &&
                            (team === "all" || s.team_id === team),
                        )
                        .map((s) => (
                          <div className="session-summary" key={s.id}>
                            <span
                              className={`session-type ${s.type === "Gym" ? "gym" : ""}`}
                            >
                              <Activity size={18} />
                            </span>
                            <div>
                              <strong>
                                {s.code}
                                <span>{s.type}</span>
                              </strong>
                              <small>
                                {s.start_time.slice(0, 5)} –{" "}
                                {s.end_time.slice(0, 5)} · {s.duration} min
                              </small>
                            </div>
                            <span className="pill neutral">
                              {s.athlete_ids.length} {t.results}
                            </span>
                          </div>
                        ))}
                      {!data.sessions.some((s) => s.date === date) && (
                        <p className="empty-small">{t.sessionEmpty}</p>
                      )}
                    </section>
                  </div>
                  <p className="footnote">
                    <ShieldCheck size={14} />
                    {t.reportFooter}
                    <span>ATHLOS © {new Date().getFullYear()}</span>
                  </p>
                </>
              )}
              {view === "overview" && (
                <>
                  <div className="panel chart-controls">
                    <select
                      aria-label={t.athlete}
                      value={chartAthlete}
                      onChange={(e) => setChartAthlete(e.target.value)}
                    >
                      <option value="all">{t.all}</option>
                      {base.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <label>
                      {t.from}
                      <input
                        type="date"
                        value={from}
                        max={to}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      {t.to}
                      <input
                        type="date"
                        value={to}
                        min={from}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </label>
                    <button
                      className="secondary"
                      onClick={() => {
                        setFrom(shiftDate(date, -27));
                        setTo(date);
                      }}
                    >
                      {t.last28}
                    </button>
                  </div>
                  <Charts
                    data={data}
                    athletes={base}
                    date={date}
                    from={from}
                    to={to}
                    selected={chartAthlete}
                    t={t}
                  />
                  <section className="panel">
                    <div className="panel-heading">
                      <h3>{t.unsubmitted}</h3>
                    </div>
                    <div className="athlete-chips">
                      {base
                        .filter(
                          (a) =>
                            !data.wellness.some(
                              (w) => w.athlete_id === a.id && w.date === date,
                            ) || !rpeDone(a),
                        )
                        .map((a) => (
                          <button
                            className="secondary"
                            key={a.id}
                            onClick={() => setSelected(a)}
                          >
                            #{a.number} {a.name}
                            <Clock3 size={14} />
                          </button>
                        ))}
                    </div>
                  </section>
                  <p className="footnote">{t.note}</p>
                </>
              )}
              {view === "players" && (
                <div className="player-grid">
                  {base.map((a) => (
                    <button
                      key={a.id}
                      className="panel player-card"
                      onClick={() => setSelected(a)}
                    >
                      <div className="player-top">
                        <span
                          className="athlete-avatar large"
                          style={{ background: a.avatar }}
                        >
                          {a.name.slice(-2)}
                        </span>
                        <span className="jersey">
                          #{String(a.number).padStart(2, "0")}
                        </span>
                      </div>
                      <h2>{a.name}</h2>
                      <p>
                        {a.position} ·{" "}
                        {data.teams.find((x) => x.id === a.team_id)?.name}
                      </p>
                      <div className="player-bottom">
                        <span>
                          {t.load}{" "}
                          <strong>
                            {number(dailyLoad(data, a.id, date))} AU
                          </strong>
                        </span>
                        <ArrowUpRight size={18} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {view === "sessions" && (
                <>
                  <div className="section-action">
                    <h2>
                      {date} · {t.sessions}
                    </h2>
                    <button
                      className="primary"
                      onClick={() => {
                        setEditingSession(undefined);
                        setModal("session");
                      }}
                    >
                      <Plus size={16} />
                      {t.addSession}
                    </button>
                  </div>
                  <div className="session-grid">
                    {data.sessions
                      .filter((s) => s.date === date)
                      .map((s) => (
                        <section key={s.id} className="panel session-card">
                          <div className="panel-heading">
                            <span className="pill success">{s.type}</span>
                            <strong>{s.code}</strong>
                            <button
                              className="text-button"
                              onClick={() => {
                                setEditingSession(s);
                                setModal("session");
                              }}
                            >
                              {locale === "zh"
                                ? "编辑"
                                : locale === "ja"
                                  ? "編集"
                                  : "Edit"}
                            </button>
                          </div>
                          <h2>
                            {s.type} {t.activity}
                          </h2>
                          <p>
                            <Clock3 size={16} />
                            {s.start_time.slice(0, 5)} –{" "}
                            {s.end_time.slice(0, 5)}
                          </p>
                          <p>
                            <Users size={16} />
                            {s.athlete_ids.length} {t.results} · {s.duration}{" "}
                            min
                          </p>
                          {staff && (
                            <div className="session-template-actions">
                              <button
                                className="secondary"
                                onClick={() => {
                                  try {
                                    downloadSessionTemplate(data, s.id, "csv");
                                  } catch (e) {
                                    notify(
                                      e instanceof Error
                                        ? e.message
                                        : t.saveError,
                                    );
                                  }
                                }}
                              >
                                CSV{" "}
                                {locale === "zh"
                                  ? "输入表"
                                  : locale === "ja"
                                    ? "入力表"
                                    : "input sheet"}
                              </button>
                              <button
                                className="secondary"
                                onClick={() => {
                                  try {
                                    downloadSessionTemplate(data, s.id, "xlsx");
                                  } catch (e) {
                                    notify(
                                      e instanceof Error
                                        ? e.message
                                        : t.saveError,
                                    );
                                  }
                                }}
                              >
                                Excel{" "}
                                {locale === "zh"
                                  ? "输入表"
                                  : locale === "ja"
                                    ? "入力表"
                                    : "input sheet"}
                              </button>
                              <button
                                className="text-button"
                                onClick={() => {
                                  setImportSessionId(s.id);
                                  setImportOpen(true);
                                }}
                              >
                                {locale === "zh"
                                  ? "导入此训练"
                                  : locale === "ja"
                                    ? "この練習を取り込む"
                                    : "Import this session"}
                              </button>
                            </div>
                          )}
                          <div className="session-roster">
                            {data.athletes
                              .filter((a) => s.athlete_ids.includes(a.id))
                              .map((a) => (
                                <button
                                  key={a.id}
                                  onClick={() => setSelected(a)}
                                  title={a.name}
                                  className="mini-avatar"
                                  style={{ background: a.avatar }}
                                >
                                  {a.number}
                                </button>
                              ))}
                          </div>
                          <p className="muted">
                            {
                              data.entries.filter(
                                (e) =>
                                  e.session_id === s.id &&
                                  e.status !== "pending",
                              ).length
                            }{" "}
                            / {s.athlete_ids.length} {t.complete}
                          </p>
                        </section>
                      ))}
                  </div>
                  {!data.sessions.some((s) => s.date === date) && (
                    <div className="empty panel">
                      <CalendarDays size={32} />
                      <h3>{t.sessionEmpty}</h3>
                    </div>
                  )}
                </>
              )}
              {view === "input" && (
                <CheckIn
                  key={date}
                  data={data}
                  date={date}
                  t={t}
                  demo={demo}
                  viewer={viewer}
                  send={send}
                  onUpdate={setData}
                  notify={notify}
                />
              )}
              {view === "medical" && medical && (
                <Medical data={data} t={t} demo={demo} notify={notify} />
              )}
              {view === "settings" && viewer.role === "administrator" && (
                <SettingsView
                  data={data}
                  t={t}
                  locale={locale}
                  demo={demo}
                  notify={notify}
                  onUpdate={setData}
                />
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <Activity size={13} /> ATHLOS <span>THE EVERYDAY ADVANTAGE.</span>
          <span className="footer-right">{t.security}</span>
        </footer>
      </div>
      {importOpen && staff && (
        <div className="modal-backdrop" onClick={() => setImportOpen(false)}>
          <section
            className="modal panel import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-heading">
              <h2 id="import-heading">
                {locale === "zh"
                  ? "批量导入"
                  : locale === "ja"
                    ? "一括取り込み"
                    : "Bulk import"}
              </h2>
              <button
                className="icon-button"
                aria-label={t.close}
                onClick={() => setImportOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <Importer
              sessionId={importSessionId}
              data={data}
              viewer={viewer}
              demo={demo}
              locale={locale}
              date={date}
              onUpdate={setData}
              notify={notify}
            />
          </section>
        </div>
      )}
      {modal === "session" && (
        <SessionForm
          existing={editingSession}
          data={data}
          date={date}
          t={t}
          demo={demo}
          send={send}
          onUpdate={setData}
          close={() => setModal(null)}
          notify={notify}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button aria-label={t.close} onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

type Labels = typeof dictionaries.zh;
type Update = React.Dispatch<React.SetStateAction<Dataset>>;
type Send = (path: string, payload: unknown) => Promise<void>;
function AthleteDetail({
  athlete: a,
  data,
  date,
  t,
  medical,
}: {
  athlete: Athlete;
  data: Dataset;
  date: string;
  t: Labels;
  medical: boolean;
}) {
  const [start, setStart] = useState(shiftDate(date, -27)),
    [end, setEnd] = useState(date);
  const values = Array.from({ length: 42 }, (_, i) =>
    dailyLoad(data, a.id, shiftDate(date, i - 41)),
  );
  const metrics = loadMetrics(values, data.settings.acwr);
  const w = data.wellness.find((w) => w.athlete_id === a.id && w.date === date);
  const aa = alerts(data, a, date);
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const week = periodLoad(
      data,
      a.id,
      shiftDate(date, -((weekday + 6) % 7)),
      date,
    ),
    month = periodLoad(data, a.id, date.slice(0, 8) + "01", date),
    period = periodLoad(data, a.id, start, end);
  return (
    <>
      <div className="detail-summary panel">
        <span className="athlete-avatar large" style={{ background: a.avatar }}>
          {a.name.slice(-2)}
        </span>
        <div>
          <h2>{a.name}</h2>
          <p>
            #{a.number} · {a.position}
          </p>
        </div>
        <div>
          <small>{t.sleepHours}</small>
          <strong>{w?.sleep_hours ?? "—"} h</strong>
        </div>
        <div>
          <small>{t.weight}</small>
          <strong>{w?.weight ?? "—"} kg</strong>
        </div>
        <div>
          <small>{t.load}</small>
          <strong>{number(dailyLoad(data, a.id, date))} AU</strong>
        </div>
      </div>
      {aa.length > 0 && (
        <div className="alert-detail panel">
          {aa.map((x, i) => (
            <span
              key={i}
              className={`pill ${x.level === "danger" ? "danger" : "warning"}`}
            >
              <TriangleAlert size={14} />
              {x.level === "danger" ? t.redFlag : t.yellowFlag} ·{" "}
              {
                (
                  {
                    sleep: t.sleepAlert,
                    pain: t.painAlert,
                    fatigue: t.fatigueAlert,
                    load: t.loadAlert,
                    weight: t.weightAlert,
                    baseline: t.baseline,
                  } as Record<string, string>
                )[x.kind]
              }{" "}
              · {x.value}
            </span>
          ))}
        </div>
      )}
      <div className="metric-grid">
        {[
          { label: t.weekLoad, value: week.total, missing: week.missing },
          { label: t.monthLoad, value: month.total, missing: month.missing },
          { label: "Rolling 7-day", value: metrics.acute },
          { label: "Rolling 28-day", value: metrics.chronic },
          { label: "Monotony", value: metrics.monotony },
          { label: "Strain", value: metrics.strain },
          {
            label: "EWMA 7 / 28",
            text: `${number(metrics.ewma7, 1)} / ${number(metrics.ewma28, 1)}`,
          },
          { label: `ACWR · ${data.settings.acwr}`, value: metrics.acwr },
        ].map((x) => (
          <section key={x.label} className="panel metric">
            <small>{x.label}</small>
            <strong>{"text" in x ? x.text : number(x.value ?? null, 2)}</strong>
            {!!x.missing && (
              <span className="text-amber">
                {x.missing} {t.missing}
              </span>
            )}
          </section>
        ))}
      </div>
      <div className="panel chart-controls">
        <label>
          {t.from}
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          {t.to}
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <span>
          {t.periodLoad}: <strong>{number(period.total)} AU</strong> ·{" "}
          {period.missing} {t.missing}
        </span>
      </div>
      <Charts
        data={data}
        athletes={data.athletes}
        date={date}
        from={start}
        to={end}
        selected={a.id}
        t={t}
      />
      <section className="panel">
        <div className="panel-heading">
          <h3>{t.history}</h3>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.date}</th>
                <th>{t.sleepHours}</th>
                <th>{t.fatigue}</th>
                <th>{t.soreness}</th>
                <th>{t.weight}</th>
                <th>{t.comment}</th>
              </tr>
            </thead>
            <tbody>
              {data.wellness
                .filter(
                  (w) =>
                    w.athlete_id === a.id && w.date >= start && w.date <= end,
                )
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((w) => (
                  <tr key={w.date}>
                    <td>{w.date}</td>
                    <td>{w.sleep_hours} h</td>
                    <td>{w.fatigue}</td>
                    <td>{w.soreness}</td>
                    <td>{w.weight} kg</td>
                    <td>{medical ? w.comment : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="footnote">{t.note}</p>
      <p className="footnote">
        ACWR coupled = (7-day sum / 7) ÷ (28-day sum / 28). Uncoupled = (7-day
        sum / 7) ÷ (preceding 28-day sum / 28). EWMA λ = 2 / (N + 1),
        initialized at first observation, minimum N days. Monotony = 7-day mean
        / population SD; zero SD → —. Strain = weekly load × monotony.
      </p>
    </>
  );
}
function CheckIn({
  data,
  date,
  t,
  demo,
  viewer,
  send,
  onUpdate,
  notify,
}: {
  data: Dataset;
  date: string;
  t: Labels;
  demo: boolean;
  viewer: Viewer;
  send: Send;
  onUpdate: Update;
  notify: (s: string) => void;
}) {
  const allowed = data.athletes.filter(
    (a) =>
      viewer.role === "administrator" ||
      viewer.role === "coach" ||
      a.id === viewer.athlete_id,
  );
  const [athleteId, setAthleteId] = useState(allowed[0]?.id ?? "");
  const [tab, setTab] = useState<"wellness" | "rpe">("wellness");
  const [busy, setBusy] = useState(false);
  const existing = data.wellness.find(
    (w) => w.athlete_id === athleteId && w.date === date,
  );
  const sessions = data.sessions
    .filter((s) => s.date === date && s.athlete_ids.includes(athleteId))
    .sort(
      (a, b) =>
        a.start_time.localeCompare(b.start_time) ||
        a.code.localeCompare(b.code),
    );
  type PainDraft = { body_part: string; severity: number };
  const [painDrafts, setPainDrafts] = useState<Record<string, PainDraft[]>>({});
  const painKey = `${athleteId}:${date}`;
  const recordedPain = data.pain
    .filter((p) => p.athlete_id === athleteId && p.date === date)
    .map(({ body_part, severity }) => ({ body_part, severity }));
  const painSites =
    painDrafts[painKey] ??
    (recordedPain.length ? recordedPain : [{ body_part: "", severity: 0 }]);
  const setPainSites = (sites: PainDraft[]) =>
    setPainDrafts((current) => ({ ...current, [painKey]: sites }));
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const selected = sessions.find((s) => s.id === sessionId);
  const oldEntry = data.entries.find(
    (e) => e.athlete_id === athleteId && e.session_id === sessionId,
  );
  // Drafts are keyed by the athlete, reporting date and session. Switching
  // between morning/afternoon/evening never reuses another session's values.
  type SessionDraft = {
    rpe: number | null;
    status: Entry["status"];
    minutes: number;
  };
  const [drafts, setDrafts] = useState<Record<string, SessionDraft>>({});
  const draftKey = `${athleteId}:${date}:${sessionId}`;
  const draft = drafts[draftKey] ?? {
    rpe: oldEntry?.rpe ?? null,
    status:
      oldEntry?.status === "pending"
        ? "attended"
        : (oldEntry?.status ?? "attended"),
    minutes: oldEntry?.minutes ?? selected?.duration ?? 0,
  };
  const { rpe, status, minutes } = draft;
  function updateDraft(next: Partial<SessionDraft>) {
    setDrafts((current) => ({ ...current, [draftKey]: { ...draft, ...next } }));
  }
  const setRpe = (rpe: number | null) => updateDraft({ rpe });
  const setStatus = (status: Entry["status"]) => updateDraft({ status });
  if (!allowed.length) return <div className="empty panel">{t.noData}</div>;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      if (tab === "wellness") {
        const value = {
          athlete_id: athleteId,
          date,
          sleep_hours: Number(f.get("sleep_hours")),
          sleep_quality: Number(f.get("sleep_quality")),
          fatigue: Number(f.get("fatigue")),
          soreness: Number(f.get("soreness")),
          stress: Number(f.get("stress")),
          appetite: Number(f.get("appetite")),
          weight: Number(f.get("weight")),
          comment: String(f.get("comment") ?? ""),
          pain: painSites
            .filter((p) => p.body_part.trim())
            .map((p) => ({ ...p, body_part: p.body_part.trim() })),
        };
        if (!demo) await send("wellness", value);
        onUpdate((d) => ({
          ...d,
          wellness: [
            ...d.wellness.filter(
              (w) => !(w.athlete_id === athleteId && w.date === date),
            ),
            value,
          ],
          pain: [
            ...d.pain.filter(
              (p) => !(p.athlete_id === athleteId && p.date === date),
            ),
            ...value.pain.map((p) => ({ ...p, athlete_id: athleteId, date })),
          ],
        }));
      } else {
        if (!selected) throw new Error(t.selectSession);
        if (["attended", "rehabilitation"].includes(status) && rpe === null)
          throw new Error(t.rpeHelp);
        const value: Entry = {
          athlete_id: athleteId,
          session_id: sessionId,
          status,
          minutes: ["attended", "rehabilitation"].includes(status)
            ? minutes
            : 0,
          rpe: ["attended", "rehabilitation"].includes(status) ? rpe : null,
        };
        if (!demo) await send("rpe", value);
        onUpdate((d) => ({
          ...d,
          entries: [
            ...d.entries.filter(
              (x) =>
                !(x.athlete_id === athleteId && x.session_id === sessionId),
            ),
            value,
          ],
        }));
      }
      notify(t.saved);
    } catch (e) {
      notify(e instanceof Error ? e.message : t.saveError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="checkin-layout">
      <section className="panel checkin">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">DAILY CHECK-IN</span>
            <h2>{tab === "wellness" ? t.morning : t.postTraining}</h2>
          </div>
          <Sun size={26} className="muted" />
        </div>
        <div className="checkin-top">
          <label>
            {t.athlete}
            <select
              value={athleteId}
              onChange={(e) => {
                setAthleteId(e.target.value);
                const ss = data.sessions.filter(
                  (s) =>
                    s.date === date && s.athlete_ids.includes(e.target.value),
                );
                setSessionId(ss[0]?.id ?? "");
              }}
            >
              {allowed.map((a) => (
                <option key={a.id} value={a.id}>
                  #{a.number} {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented">
            {
              <button
                className={tab === "wellness" ? "active" : ""}
                onClick={() => setTab("wellness")}
              >
                {t.wellness}
              </button>
            }
            <button
              className={tab === "rpe" ? "active" : ""}
              onClick={() => setTab("rpe")}
            >
              RPE
            </button>
          </div>
        </div>
        {tab === "wellness" ? (
          <p className="checkin-help muted">{t.dailyWellnessHelp}</p>
        ) : (
          <section
            className="session-checkin-overview"
            aria-label={t.sessionsForDay}
          >
            <div className="panel-heading">
              <h3>
                {t.sessionsForDay} · {date}
              </h3>
              <span className="pill neutral">{sessions.length}</span>
            </div>
            <p className="checkin-help muted">{t.perSessionHelp}</p>
            <div className="session-grid checkin-session-grid">
              {sessions.map((s, index) => {
                const response = data.entries.find(
                  (e) => e.athlete_id === athleteId && e.session_id === s.id,
                );
                const done = response && response.status !== "pending";
                const load =
                  response &&
                  ["attended", "rehabilitation"].includes(response.status)
                    ? response.minutes * (response.rpe ?? 0)
                    : done
                      ? 0
                      : null;
                return (
                  <button
                    type="button"
                    key={s.id}
                    aria-pressed={sessionId === s.id}
                    data-session-id={s.id}
                    className={`session-card panel session-choice ${sessionId === s.id ? "selected" : ""}`}
                    onClick={() => setSessionId(s.id)}
                  >
                    <div className="panel-heading">
                      <strong>
                        {index + 1}. {s.code}
                      </strong>
                      <span className={`pill ${done ? "success" : "warning"}`}>
                        {done ? t.sessionSaved : t.sessionPending}
                      </span>
                    </div>
                    <p>
                      {s.type} · {s.start_time.slice(0, 5)}–
                      {s.end_time.slice(0, 5)}
                    </p>
                    <p>
                      {t.defaultMinutes}: {s.duration} min
                    </p>
                    <p>
                      {response && response.status !== "pending"
                        ? t[response.status]
                        : t.pending}
                    </p>
                    <strong>
                      {response?.rpe === null || response?.rpe === undefined
                        ? "RPE —"
                        : `RPE ${response.rpe}`}{" "}
                      · {number(load)} AU
                    </strong>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <form key={athleteId + tab + sessionId} onSubmit={submit}>
          {tab === "wellness" ? (
            <>
              <div className="form-grid">
                <label>
                  {t.sleepHours}
                  <div className="unit-input">
                    <input
                      type="number"
                      name="sleep_hours"
                      min="0"
                      max="24"
                      step="0.1"
                      defaultValue={existing?.sleep_hours ?? 8}
                      required
                    />
                    <span>h</span>
                  </div>
                </label>
                <label>
                  {t.weight}
                  <div className="unit-input">
                    <input
                      type="number"
                      name="weight"
                      min="20"
                      max="300"
                      step="0.1"
                      defaultValue={existing?.weight ?? 70}
                      required
                    />
                    <span>kg</span>
                  </div>
                </label>
              </div>
              {(
                [
                  "sleep_quality",
                  "fatigue",
                  "soreness",
                  "stress",
                  "appetite",
                ] as const
              ).map((key) => {
                const scale = data.settings.scales[key];
                return (
                  <fieldset className="scale-field" key={key}>
                    <legend>
                      {t[key === "sleep_quality" ? "sleepQuality" : key]}
                      <small>{t[scale.direction]}</small>
                    </legend>
                    <div className="scale-buttons">
                      {Array.from(
                        { length: scale.max - scale.min + 1 },
                        (_, i) => scale.min + i,
                      ).map((n) => (
                        <label key={n}>
                          <input
                            type="radio"
                            name={key}
                            value={n}
                            defaultChecked={
                              n ===
                              (existing?.[key] ??
                                Math.round((scale.max + scale.min) / 2))
                            }
                            required
                          />
                          <span>{n}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
              {painSites.map((pain, index) => (
                <div className="form-grid pain-site-editor" key={index}>
                  <label>
                    {t.bodyPart}
                    {index > 0 ? ` ${index + 1}` : ""}
                    <input
                      maxLength={100}
                      value={pain.body_part}
                      onChange={(e) =>
                        setPainSites(
                          painSites.map((p, i) =>
                            i === index
                              ? { ...p, body_part: e.target.value }
                              : p,
                          ),
                        )
                      }
                      placeholder={t.noPain}
                    />
                  </label>
                  <label>
                    {t.severity}
                    {index > 0 ? ` ${index + 1}` : ""} (0–10)
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="1"
                      value={pain.severity}
                      onChange={(e) =>
                        setPainSites(
                          painSites.map((p, i) =>
                            i === index
                              ? { ...p, severity: Number(e.target.value) }
                              : p,
                          ),
                        )
                      }
                    />
                  </label>
                  {painSites.length > 1 && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setPainSites(painSites.filter((_, i) => i !== index))
                      }
                    >
                      <X size={13} />
                      {t.removePainSite} {index + 1}
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="secondary"
                disabled={painSites.length >= 20}
                onClick={() =>
                  setPainSites([...painSites, { body_part: "", severity: 0 }])
                }
              >
                <Plus size={14} />
                {t.addPainSite}
              </button>
              <label>
                {t.comment}
                <textarea
                  name="comment"
                  maxLength={2000}
                  rows={3}
                  defaultValue={existing?.comment}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                {t.selectSession}
                <select
                  value={sessionId}
                  onChange={(e) => {
                    setSessionId(e.target.value);
                  }}
                  required
                >
                  <option value="" disabled>
                    {t.selectSession}
                  </option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.type} · {s.start_time.slice(0, 5)}
                    </option>
                  ))}
                </select>
              </label>
              {!sessions.length && <p className="empty-small">{t.noSession}</p>}
              <div className="form-grid">
                <label>
                  {t.status}
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as Entry["status"])
                    }
                  >
                    {(
                      [
                        "attended",
                        "rehabilitation",
                        "rest",
                        "absent",
                        "not_participating",
                      ] as const
                    ).map((s) => (
                      <option value={s} key={s}>
                        {t[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.actualMinutes}
                  <input
                    name="minutes"
                    type="number"
                    min="0"
                    max="600"
                    value={
                      ["attended", "rehabilitation"].includes(status)
                        ? minutes
                        : 0
                    }
                    disabled={!["attended", "rehabilitation"].includes(status)}
                    onChange={(e) =>
                      updateDraft({ minutes: Number(e.target.value) })
                    }
                    required
                  />
                </label>
              </div>
              {["attended", "rehabilitation"].includes(status) && (
                <fieldset className="scale-field">
                  <legend>
                    RPE <small>{t.rpeHelp}</small>
                  </legend>
                  <div className="rpe-buttons">
                    {Array.from({ length: 11 }, (_, n) => (
                      <button
                        type="button"
                        className={rpe === n ? "selected" : ""}
                        key={n}
                        onClick={() => setRpe(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="formula-box">
                {selected?.code ?? "—"} · sRPE Load ={" "}
                {["attended", "rehabilitation"].includes(status) ? minutes : 0}{" "}
                min ×{" "}
                {["attended", "rehabilitation"].includes(status)
                  ? (rpe ?? "—")
                  : 0}{" "}
                ={" "}
                {["attended", "rehabilitation"].includes(status)
                  ? number(rpe === null ? null : minutes * rpe)
                  : 0}{" "}
                AU
              </div>
            </>
          )}
          <div className="form-actions">
            <button
              className="primary"
              disabled={busy || (tab === "rpe" && !sessions.length)}
            >
              <Check size={16} />
              {busy ? t.loading : t.save}
            </button>
          </div>
        </form>
      </section>
      <aside className="checkin-aside panel">
        <span className="eyebrow">CONSISTENCY MATTERS</span>
        <Heart size={42} />
        <h2>
          Listen to your body.
          <br />
          Build your tomorrow.
        </h2>
        <p>{t.note}</p>
        <div className="privacy-note">
          <ShieldCheck size={18} />
          <span>{t.security}</span>
        </div>
      </aside>
    </div>
  );
}
function SessionForm({
  existing,
  data,
  date,
  t,
  demo,
  send,
  onUpdate,
  close,
  notify,
}: {
  existing?: Session;
  data: Dataset;
  date: string;
  t: Labels;
  demo: boolean;
  send: Send;
  onUpdate: Update;
  close: () => void;
  notify: (s: string) => void;
}) {
  const [team, setTeam] = useState(
    existing?.team_id ?? data.teams[0]?.id ?? "",
  );
  const [ids, setIds] = useState(
    existing?.athlete_ids ??
      data.athletes
        .filter((a) => (a.team_ids ?? [a.team_id]).includes(team))
        .map((a) => a.id),
  );
  const [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <h2 id="session-heading">{existing ? t.sessions : t.newSession}</h2>
          <button className="icon-button" onClick={close} aria-label={t.close}>
            <X size={20} />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const f = new FormData(e.currentTarget);
              if (String(f.get("end")) <= String(f.get("start")))
                throw new Error("End time must follow start time");
              const value: Omit<Session, "id"> = {
                code: String(f.get("code")),
                date: String(f.get("date")),
                team_id: team,
                type: String(f.get("type")),
                start_time: String(f.get("start")),
                end_time: String(f.get("end")),
                duration: Number(f.get("duration")),
                athlete_ids: ids,
              };
              if (!ids.length) throw new Error(t.selectPlayers);
              if (!demo) {
                await send("sessions", {
                  ...value,
                  ...(existing ? { id: existing.id } : {}),
                });
                location.reload();
                return;
              }
              if (
                existing &&
                data.entries.some(
                  (e) =>
                    e.session_id === existing.id &&
                    e.status !== "pending" &&
                    !ids.includes(e.athlete_id),
                )
              )
                throw new Error(
                  "Cannot remove an athlete with a submitted response",
                );
              const session = {
                ...value,
                id: existing?.id ?? crypto.randomUUID(),
              };
              onUpdate((d) => ({
                ...d,
                sessions: [
                  ...d.sessions.filter((s) => s.id !== session.id),
                  session,
                ],
                entries: [
                  ...d.entries
                    .filter(
                      (e) =>
                        e.session_id !== session.id ||
                        ids.includes(e.athlete_id),
                    )
                    .map((e) =>
                      e.session_id === session.id && e.status === "pending"
                        ? { ...e, minutes: value.duration }
                        : e,
                    ),
                  ...ids
                    .filter(
                      (id) =>
                        !d.entries.some(
                          (e) =>
                            e.athlete_id === id && e.session_id === session.id,
                        ),
                    )
                    .map((athlete_id) => ({
                      athlete_id,
                      session_id: session.id,
                      status: "pending" as const,
                      minutes: value.duration,
                      rpe: null,
                    })),
                ],
              }));
              notify(t.saved);
              close();
            } catch (e) {
              notify(e instanceof Error ? e.message : t.saveError);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              {t.code}
              <input
                name="code"
                required
                maxLength={30}
                defaultValue={
                  existing?.code ??
                  `TR${String(data.sessions.length + 1).padStart(3, "0")}`
                }
              />
            </label>
            <label>
              {t.date}
              <input
                type="date"
                name="date"
                defaultValue={existing?.date ?? date}
                required
              />
            </label>
            <label>
              {t.team}
              <select
                disabled={!!existing}
                value={team}
                onChange={(e) => {
                  setTeam(e.target.value);
                  setIds(
                    data.athletes
                      .filter((a) =>
                        (a.team_ids ?? [a.team_id]).includes(e.target.value),
                      )
                      .map((a) => a.id),
                  );
                }}
              >
                {data.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.type}
              <select name="type" defaultValue={existing?.type}>
                {["Field", "Gym", "Rehabilitation", "Match", "Other"].map(
                  (t) => (
                    <option key={t}>{t}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              {t.start}
              <input
                name="start"
                type="time"
                defaultValue={existing?.start_time.slice(0, 5) ?? "09:00"}
                required
              />
            </label>
            <label>
              {t.end}
              <input
                name="end"
                type="time"
                defaultValue={existing?.end_time.slice(0, 5) ?? "10:10"}
                required
              />
            </label>
            <label>
              {t.duration}
              <input
                name="duration"
                type="number"
                min="0"
                max="600"
                defaultValue={existing?.duration ?? 70}
                required
              />
            </label>
          </div>
          <fieldset className="roster-field">
            <legend>
              {t.selectPlayers} ({ids.length})
            </legend>
            <div>
              {data.athletes
                .filter((a) => (a.team_ids ?? [a.team_id]).includes(team))
                .map((a) => (
                  <label key={a.id}>
                    <input
                      type="checkbox"
                      checked={ids.includes(a.id)}
                      onChange={(e) =>
                        setIds((x) =>
                          e.target.checked
                            ? [...x, a.id]
                            : x.filter((id) => id !== a.id),
                        )
                      }
                    />
                    <span>
                      #{a.number} {a.name}
                    </span>
                  </label>
                ))}
            </div>
          </fieldset>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={close}>
              {t.cancel}
            </button>
            <button className="primary" disabled={busy}>
              {busy ? t.loading : existing ? t.save : t.addSession}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function SettingsView({
  data,
  t,
  locale,
  demo,
  notify,
  onUpdate,
}: {
  data: Dataset;
  t: Labels;
  locale: string;
  demo: boolean;
  notify: (s: string) => void;
  onUpdate: Update;
}) {
  const [settings, setSettings] = useState<Settings>(
    structuredClone(data.settings),
  );
  const [busy, setBusy] = useState(false);
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const errors = thresholdErrors(settings);
            if (errors.length) throw new Error(errors.join(" · "));
            if (!demo) {
              const r = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
              });
              if (!r.ok) throw new Error(t.saveError);
            }
            onUpdate((d) => ({ ...d, settings }));
            notify(t.settingsSaved);
          } catch (e) {
            notify(e instanceof Error ? e.message : t.saveError);
          } finally {
            setBusy(false);
          }
        }}
        className="settings-layout"
      >
        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>{t.alertRules}</h2>
            <TriangleAlert size={20} />
          </div>
          <p className="muted flag-legend">{t.flagLegend}</p>
          <div className="form-grid">
            {(
              [
                "sleepMin",
                "sleepRedMin",
                "fatigueMax",
                "fatigueRed",
                "painMin",
                "painRedMin",
                "weightChangePct",
                "loadMax",
                "loadRedMax",
                "loadSpikePct",
                "sleepQualityDrop",
                "newPainMin",
                "wellnessDeviation",
              ] as const
            ).map((k) => (
              <label key={k}>
                {t[k]}
                <input
                  type="number"
                  step="0.1"
                  required
                  min="0"
                  max={
                    k === "loadSpikePct"
                      ? 1000
                      : k === "loadMax" || k === "loadRedMax"
                        ? 6000
                        : k === "sleepMin" || k === "sleepRedMin"
                          ? 24
                          : k === "weightChangePct"
                            ? 100
                            : 10
                  }
                  value={settings[k]}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, [k]: Number(e.target.value) }))
                  }
                />
              </label>
            ))}
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>{t.scales}</h2>
            <SlidersHorizontal size={20} />
          </div>
          {(Object.keys(settings.scales) as (keyof Settings["scales"])[]).map(
            (key) => (
              <div className="scale-config" key={key}>
                <strong>
                  {t[key === "sleep_quality" ? "sleepQuality" : key]}
                </strong>
                <label>
                  {t.min}
                  <input
                    type="number"
                    min="0"
                    max={settings.scales[key].max - 1}
                    value={settings.scales[key].min}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        scales: {
                          ...s.scales,
                          [key]: {
                            ...s.scales[key],
                            min: Number(e.target.value),
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  {t.max}
                  <input
                    type="number"
                    min={settings.scales[key].min + 1}
                    max="10"
                    value={settings.scales[key].max}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        scales: {
                          ...s.scales,
                          [key]: {
                            ...s.scales[key],
                            max: Number(e.target.value),
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  {t.direction}
                  <select
                    value={settings.scales[key].direction}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        scales: {
                          ...s.scales,
                          [key]: {
                            ...s.scales[key],
                            direction: e.target.value as
                              "higher_better" | "higher_worse",
                          },
                        },
                      }))
                    }
                  >
                    <option value="higher_better">{t.higher_better}</option>
                    <option value="higher_worse">{t.higher_worse}</option>
                  </select>
                </label>
              </div>
            ),
          )}
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>{t.calculation}</h2>
          </div>
          <label>
            {t.method}
            <select
              value={settings.acwr}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  acwr: e.target.value as Settings["acwr"],
                }))
              }
            >
              <option value="coupled">Rolling · coupled (7 / 28 days)</option>
              <option value="uncoupled">
                Rolling · uncoupled (7 / preceding 28 days)
              </option>
              <option value="ewma">EWMA (7 / 28 days)</option>
            </select>
          </label>
          <p className="muted">{t.note}</p>
        </section>
        <section className="panel settings-panel">
          <h2>
            {t.organization} & {t.staff}
          </h2>
          <p className="muted">{t.adminInfo}</p>
        </section>
        <div className="form-actions">
          <button className="primary" disabled={busy}>
            <Check size={16} />
            {busy ? t.loading : t.save}
          </button>
        </div>
      </form>
      <Management
        data={data}
        demo={demo}
        locale={locale}
        notify={notify}
        onUpdate={onUpdate}
      />
    </>
  );
}
function Medical({
  data,
  t,
  demo,
  notify,
}: {
  data: Dataset;
  t: Labels;
  demo: boolean;
  notify: (s: string) => void;
}) {
  const [notes, setNotes] = useState<
      { id: string; athlete_id: string; note: string; created_at: string }[]
    >([]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!demo)
      fetch("/api/medical")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((j) => setNotes(j.notes))
        .catch(() => notify(t.saveError));
  }, [demo, t.saveError]);
  return (
    <div className="medical-layout">
      <section className="panel settings-panel">
        <h2>{t.medicalNote}</h2>
        <p className="muted">{t.medicalSub}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            try {
              const f = new FormData(form);
              const value = {
                athlete_id: String(f.get("athlete_id")),
                note: String(f.get("note")),
              };
              if (demo)
                setNotes((x) => [
                  {
                    ...value,
                    id: crypto.randomUUID(),
                    created_at: new Date().toISOString(),
                  },
                  ...x,
                ]);
              else {
                const r = await fetch("/api/medical", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(value),
                });
                if (!r.ok) throw new Error(t.saveError);
                const j = await r.json();
                setNotes((x) => [j.note, ...x]);
              }
              form.reset();
              notify(t.saved);
            } catch {
              notify(t.saveError);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t.athlete}
            <select name="athlete_id" required>
              {data.athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.comment}
            <textarea
              rows={6}
              name="note"
              maxLength={5000}
              minLength={1}
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? t.loading : t.save}
          </button>
        </form>
      </section>
      <section className="panel settings-panel">
        <h2>{t.medicalHistory}</h2>
        {notes.map((n) => (
          <article className="medical-note" key={n.id}>
            <strong>
              {data.athletes.find((a) => a.id === n.athlete_id)?.name}
            </strong>
            <small>{new Date(n.created_at).toLocaleString()}</small>
            <p>{n.note}</p>
          </article>
        ))}
        {!notes.length && (
          <div className="empty">
            <Stethoscope size={30} />
            <p>{t.noMedical}</p>
          </div>
        )}
      </section>
    </div>
  );
}
