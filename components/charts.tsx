"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  alerts,
  flagLevel,
  loadFlag,
  flagColors,
  dailyLoad,
  shiftDate,
} from "@/lib/analytics";
import type { Dataset, Athlete } from "@/lib/types";
import type { Labels } from "@/lib/i18n";
import { useLanguage } from "./language-provider";
export default function Charts({
  data,
  athletes,
  date,
  from,
  to,
  selected,
  t,
}: {
  data: Dataset;
  athletes: Athlete[];
  date: string;
  from: string;
  to: string;
  selected: string;
  t: Labels;
}) {
  const { number } = useLanguage();
  const finding = (a: ReturnType<typeof alerts>[number]) => {
    const labels: Record<string, string> = {
      sleep: t.sleepAlert,
      pain: t.painAlert,
      fatigue: t.fatigueAlert,
      load: t.loadAlert,
      weight: t.weightAlert,
      baseline: t.baseline,
    };
    return `${labels[a.kind] ?? a.kind}: ${a.value}`;
  };
  const subject =
    selected === "all" ? athletes : athletes.filter((a) => a.id === selected);
  const days = [];
  for (let d = from; d <= to && days.length < 366; d = shiftDate(d, 1))
    days.push(d);
  const mean = (v: (number | null)[]) => {
    const a = v.filter((x) => x !== null) as number[];
    return a.length ? a.reduce((a, b) => a + b, 0) / a.length : null;
  };
  const trend = days.map((d) => ({
    date: d.slice(5),
    team: mean(athletes.map((a) => dailyLoad(data, a.id, d))),
    load: mean(subject.map((a) => dailyLoad(data, a.id, d))),
    risk:
      selected === "all"
        ? "normal"
        : loadFlag(dailyLoad(data, subject[0]?.id ?? "", d), data.settings),
    reasons:
      selected === "all"
        ? []
        : subject[0]
          ? alerts(data, subject[0], d, t).map(finding)
          : [],
  }));
  const bars = subject.map((a) => ({
    name: a.name,
    risk: loadFlag(dailyLoad(data, a.id, date), data.settings),
    overall: flagLevel(data, a, date),
    reasons: alerts(data, a, date, t).map(finding),
    load: dailyLoad(data, a.id, date),
    fatigue: data.wellness.find((w) => w.athlete_id === a.id && w.date === date)
      ?.fatigue,
  }));
  const radar = (
    ["sleep_quality", "fatigue", "soreness", "stress", "appetite"] as const
  ).map((key) => {
    const s = data.settings.scales[key];
    const norm = (n: number) =>
      s.max === s.min
        ? 0
        : ((s.direction === "higher_better" ? n - s.min : s.max - n) /
            (s.max - s.min)) *
          100;
    const w = data.wellness.filter((w) => w.date === date);
    return {
      metric: t[key === "sleep_quality" ? "sleepQuality" : key],
      team: mean(
        w
          .filter((w) => athletes.some((a) => a.id === w.athlete_id))
          .map((w) => norm(w[key])),
      ),
      value: mean(
        w
          .filter((w) => subject.some((a) => a.id === w.athlete_id))
          .map((w) => norm(w[key])),
      ),
    };
  });
  const weekly = Array.from({ length: 4 }, (_, i) => {
    const end = shiftDate(date, -(3 - i) * 7);
    const start = shiftDate(end, -6);
    const values = subject.flatMap((a) =>
      Array.from({ length: 7 }, (_, j) =>
        dailyLoad(data, a.id, shiftDate(start, j)),
      ),
    );
    const missing = values.filter((v) => v === null).length;
    return {
      name: `${start.slice(5)} – ${end.slice(5)}`,
      load:
        missing || !values.length
          ? null
          : (values as number[]).reduce((a, b) => a + b, 0),
      missing,
    };
  });
  const positions = ["GK", "DF", "MF", "FW"].map((p) => ({
    name: p,
    load: mean(
      athletes
        .filter((a) => a.position === p)
        .map((a) => dailyLoad(data, a.id, date)),
    ),
  }));
  const levels = {
    red: t.redFlag,
    yellow: t.yellowFlag,
    normal: t.noFlag,
    missing: t.missingFlag,
  };
  const riskRows = subject.map((a) => ({
    athlete: a,
    level: flagLevel(data, a, date),
    findings: alerts(data, a, date, t),
  }));
  const loadReferences = (
    <>
      <ReferenceLine
        y={data.settings.loadMax}
        stroke={flagColors.yellow}
        strokeDasharray="5 4"
        ifOverflow="extendDomain"
        label={{
          value: `${t.yellowFlag}: >${data.settings.loadMax} AU`,
          fontSize: 9,
          position: "insideTopLeft",
          fill: flagColors.yellow,
        }}
      />
      <ReferenceLine
        y={data.settings.loadRedMax ?? 1000}
        stroke={flagColors.red}
        strokeDasharray="5 4"
        ifOverflow="extendDomain"
        label={{
          value: `${t.redFlag}: ≥${data.settings.loadRedMax ?? 1000} AU`,
          fontSize: 9,
          position: "insideTopLeft",
          fill: flagColors.red,
        }}
      />
    </>
  );
  const loadTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const row =
      payload.find((p: any) => p.dataKey === "load")?.payload ??
      payload[0].payload;
    return (
      <div
        style={{
          background: "white",
          border: "1px solid #dde4d8",
          padding: 12,
          borderRadius: 6,
          fontSize: 11,
          maxWidth: 300,
        }}
      >
        <strong>{row.name ?? label}</strong>
        <p>
          {t.load}: {number(row.load === null ? null : Number(row.load))} AU
        </p>
        {row.risk && (
          <p style={{ color: flagColors[row.risk as keyof typeof flagColors] }}>
            {levels[row.risk as keyof typeof levels]}
          </p>
        )}
        {row.reasons?.map((reason: string, i: number) => (
          <p key={i}>{reason}</p>
        ))}
      </div>
    );
  };
  return (
    <div className="chart-grid">
      <section
        className="panel"
        data-testid="flags-summary"
        style={{ gridColumn: "1 / -1" }}
      >
        <div className="panel-heading">
          <h3>
            {t.status} · {date}
          </h3>
          <span className="muted">{t.flagReason}</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            padding: "0 20px 15px",
          }}
        >
          {(Object.keys(levels) as (keyof typeof levels)[]).map((level) => (
            <span
              key={level}
              style={{
                color: flagColors[level],
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <span aria-hidden="true">● </span>
              {levels[level]} (
              {riskRows.filter((r) => r.level === level).length})
            </span>
          ))}
        </div>
        <div className="table-scroll" style={{ maxHeight: 240 }}>
          <table>
            <thead>
              <tr>
                <th>{t.athlete}</th>
                <th>{t.status}</th>
                <th>{t.flagReason}</th>
              </tr>
            </thead>
            <tbody>
              {riskRows.map((r) => (
                <tr key={r.athlete.id}>
                  <td>{r.athlete.name}</td>
                  <td style={{ color: flagColors[r.level], fontWeight: 600 }}>
                    {levels[r.level]}
                  </td>
                  <td style={{ whiteSpace: "normal" }}>
                    {r.findings.length
                      ? r.findings
                          .map(
                            (f) =>
                              `${f.level === "danger" ? t.redFlag : t.yellowFlag}: ${f.value}`,
                          )
                          .join(" · ")
                      : r.level === "missing"
                        ? t.missingFlag
                        : t.noFlag}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="chart-note">{t.flagLegend}</p>
      </section>
      <section className="panel chart-wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{t.trainingIntelligence}</span>
            <h3>{t.loadTrend}</h3>
          </div>
          <span className="pill neutral">AU</span>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="loadFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#829f62" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#829f62" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 4"
                vertical={false}
                stroke="#eceee9"
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              {selected !== "all" && loadReferences}
              <Tooltip content={selected === "all" ? undefined : loadTooltip} />
              <Legend />
              <Area
                isAnimationActive={false}
                name={t.teamAverage}
                dataKey="team"
                stroke="#bdc5b8"
                fill="none"
                strokeDasharray="4 4"
              />
              <Area
                isAnimationActive={false}
                name={selected === "all" ? t.load : subject[0]?.name}
                dataKey="load"
                stroke="#637d48"
                fill="url(#loadFill)"
                strokeWidth={2.5}
                connectNulls={false}
                dot={
                  selected === "all"
                    ? false
                    : (props: any) =>
                        props.value === null ? (
                          <g key={props.index} />
                        ) : (
                          <circle
                            key={props.index}
                            cx={props.cx}
                            cy={props.cy}
                            r={3.5}
                            fill={
                              flagColors[
                                props.payload.risk as keyof typeof flagColors
                              ]
                            }
                            stroke="white"
                            strokeWidth={1}
                          />
                        )
                }
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {selected !== "all" && (
          <div className="flag-thresholds" data-testid="load-threshold-legend">
            <span style={{ color: flagColors.yellow }}>
              {t.yellowFlag}: &gt; {data.settings.loadMax} AU
            </span>
            <span style={{ color: flagColors.red, marginLeft: 16 }}>
              {t.redFlag}: ≥ {data.settings.loadRedMax} AU
            </span>
          </div>
        )}
        <p className="chart-note">
          {selected === "all" ? t.aggregateFlagNote : t.loadFlagNote}
        </p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h3>{t.wellnessProfile}</h3>
          <span className="pill neutral">0–100</span>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radar}>
              <PolarGrid stroke="#e4e8e0" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <Radar
                isAnimationActive={false}
                name={t.teamAverage}
                dataKey="team"
                stroke="#b1b8a7"
                fill="#c6d1bc"
                fillOpacity={0.15}
              />
              <Radar
                isAnimationActive={false}
                name={selected === "all" ? t.wellness : subject[0]?.name}
                dataKey="value"
                stroke="#728e54"
                fill="#98b278"
                fillOpacity={0.3}
              />
              <Tooltip />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-note">
          100 = {t.higher_better} · {t.scales}. {t.aggregateFlagNote}
        </p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h3>{t.weekly}</h3>
          <span className="muted">AU · {t.last28}</span>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly}>
              <CartesianGrid vertical={false} stroke="#eceee9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Bar
                isAnimationActive={false}
                name={t.load}
                dataKey="load"
                fill="#9db77f"
                radius={[5, 5, 0, 0]}
                maxBarSize={46}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-note">{t.reportFooter}</p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h3>{t.positionComparison}</h3>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={positions}>
              <CartesianGrid vertical={false} stroke="#eceee9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Bar
                isAnimationActive={false}
                name={t.load}
                dataKey="load"
                fill="#81976e"
                radius={[5, 5, 0, 0]}
                maxBarSize={46}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel chart-wide">
        <div className="panel-heading">
          <h3>{t.loadComparison}</h3>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars}>
              <CartesianGrid vertical={false} stroke="#eceee9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              {loadReferences}
              <Tooltip content={loadTooltip} />
              <Bar
                isAnimationActive={false}
                name={t.load}
                dataKey="load"
                fill="#9db77f"
                radius={[4, 4, 0, 0]}
              >
                {bars.map((b, i) => (
                  <Cell key={i} fill={flagColors[b.risk]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-note">{t.loadFlagNote}</p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h3>{t.scatter}</h3>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid stroke="#eceee9" />
              <XAxis
                type="number"
                dataKey="fatigue"
                name={t.fatigue}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="load"
                name={t.load}
                unit=" AU"
                tick={{ fontSize: 10 }}
              />
              <ZAxis range={[50, 50]} />
              <Tooltip
                content={loadTooltip}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Scatter
                isAnimationActive={false}
                name={t.athlete}
                data={bars
                  .filter((b) => b.load !== null && b.fatigue !== undefined)
                  .map((b) => ({ ...b, risk: b.overall }))}
                fill="#81976e"
              >
                {bars
                  .filter((b) => b.load !== null && b.fatigue !== undefined)
                  .map((b, i) => (
                    <Cell key={i} fill={flagColors[b.overall]} />
                  ))}
              </Scatter>
              <ReferenceLine
                x={data.settings.fatigueMax}
                stroke={flagColors.yellow}
                strokeDasharray="4 4"
              />
              <ReferenceLine
                x={data.settings.fatigueRed ?? data.settings.scales.fatigue.max}
                stroke={flagColors.red}
                strokeDasharray="4 4"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
