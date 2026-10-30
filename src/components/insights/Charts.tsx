"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthLabel } from "@/lib/dates";
import { fmtMoney, fmtPct } from "@/lib/money";

export interface TrendPoint {
  month: string;
  income: number;
  need: number;
  want: number;
  savings: number;
  business: number;
  spent: number;
  savingsRate: number | null;
}

const axisTick = { fontSize: 11, fill: "var(--ink-3)", fontFamily: "var(--font-plex-mono)" } as const;
const compact = (c: number) => {
  if (c <= 0) return "$0";
  if (c < 100_000) return `$${Math.round(c / 100)}`;
  const k = c / 100_000;
  return `$${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
};
const compactSigned = (c: number) => (c < 0 ? `−${compact(-c)}` : compact(c));

/** Fixed hue order for goal bands: the emergency fund is always first and always green. */
export const GOAL_SERIES_COLORS = ["var(--save)", "var(--need)", "var(--want)", "var(--warn)"];
export const GOAL_OTHER_COLOR = "var(--ink-3)";

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 text-ink-2">
          <span className="flex items-center gap-1.5">
            {r.color && <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: r.color }} />}
            {r.label}
          </span>
          <span className="num font-medium text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function CashflowChart({ points }: { points: TrendPoint[] }) {
  const data = points.map((p) => ({ ...p, label: monthLabel(p.month, "short"), incomeDot: p.income > 0 ? p.income : null }));
  const hasBusiness = points.some((p) => p.business > 0);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
          <Tooltip
            cursor={{ fill: "var(--card-2)" }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d) return null;
              return (
                <TooltipBox
                  title={monthLabel(d.month)}
                  rows={[
                    { label: "Income", value: fmtMoney(d.income, { whole: true }), color: "var(--ink)" },
                    { label: "Needs", value: fmtMoney(d.need, { whole: true }), color: "var(--need)" },
                    { label: "Wants", value: fmtMoney(d.want, { whole: true }), color: "var(--want)" },
                    { label: "Saving", value: fmtMoney(d.savings, { whole: true }), color: "var(--save)" },
                    ...(d.business > 0 ? [{ label: "Business", value: fmtMoney(d.business, { whole: true }), color: "var(--ink-3)" }] : []),
                    { label: "Kept", value: fmtMoney(d.income - d.need - d.want - d.business, { whole: true, signed: true }) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="need" stackId="s" fill="var(--need)" maxBarSize={24} stroke="var(--card)" strokeWidth={1} />
          <Bar dataKey="want" stackId="s" fill="var(--want)" maxBarSize={24} stroke="var(--card)" strokeWidth={1} />
          <Bar dataKey="savings" stackId="s" fill="var(--save)" maxBarSize={24} stroke="var(--card)" strokeWidth={1} radius={hasBusiness ? undefined : [4, 4, 0, 0]} />
          {hasBusiness && <Bar dataKey="business" stackId="s" fill="var(--ink-3)" maxBarSize={24} stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} />}
          <Scatter dataKey="incomeDot" fill="var(--ink)" stroke="var(--card)" strokeWidth={2} shape="circle" legendType="none" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SavingsRateChart({ points, target }: { points: TrendPoint[]; target: number }) {
  const data = points.map((p) => ({ label: monthLabel(p.month, "short"), month: p.month, rate: p.savingsRate === null ? null : Math.round(p.savingsRate * 1000) / 10 }));
  const values = data.map((d) => d.rate).filter((v): v is number => v !== null);
  const min = Math.min(0, ...values, target * 100 - 5);
  const max = Math.max(target * 100 + 10, ...values);
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={40} domain={[Math.floor(min / 10) * 10, Math.ceil(max / 10) * 10]} />
          <ReferenceLine y={target * 100} stroke="var(--ink-3)" strokeWidth={1} label={{ value: `target ${fmtPct(target)}`, position: "insideTopRight", fontSize: 11, fill: "var(--ink-3)" }} />
          <ReferenceLine y={0} stroke="var(--line-strong)" strokeWidth={1} />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d || d.rate === null) return null;
              return <TooltipBox title={monthLabel(d.month)} rows={[{ label: "Savings rate", value: `${d.rate}%`, color: "var(--save)" }]} />;
            }}
          />
          <Line type="monotone" dataKey="rate" stroke="var(--save)" strokeWidth={2} dot={{ r: 4, fill: "var(--save)", stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface KeptPoint {
  month: string;
  income: number;
  spent: number;
  /** income − needs − wants − business; null when no income was logged that month. */
  kept: number | null;
}

/** One bar per month: green above the line when income beat spending, red below when it didn't. */
export function KeptChart({ points }: { points: KeptPoint[] }) {
  const data = points.map((p) => ({ ...p, label: monthLabel(p.month, "short") }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compactSigned} width={48} />
          <ReferenceLine y={0} stroke="var(--line-strong)" strokeWidth={1} />
          <Tooltip
            cursor={{ fill: "var(--card-2)" }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d) return null;
              return (
                <TooltipBox
                  title={monthLabel(d.month)}
                  rows={[
                    { label: "Income", value: fmtMoney(d.income, { whole: true }), color: "var(--ink)" },
                    { label: "Spent", value: fmtMoney(d.spent, { whole: true }), color: "var(--want)" },
                    { label: "Kept", value: d.kept === null ? "no income logged" : fmtMoney(d.kept, { whole: true, signed: true }), color: d.kept !== null && d.kept < 0 ? "var(--over)" : "var(--save)" },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="kept" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.month} fill={d.kept !== null && d.kept < 0 ? "var(--over)" : "var(--save)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface BalanceSeriesPoint {
  month: string;
  byGoal: Record<string, number>;
  total: number;
}

/**
 * Stacked bands, one per goal (up to four, the rest folded into "Other"), so the total balance is the top edge.
 * `forecast` continues the total as a dashed line at the current pace; `target` marks the sum of all goal targets.
 */
export function SavingsBalanceChart({ points, goals, forecast = [], target }: { points: BalanceSeriesPoint[]; goals: { id: string; name: string }[]; forecast?: { month: string; total: number }[]; target?: number }) {
  const shown = goals.slice(0, GOAL_SERIES_COLORS.length);
  const rest = goals.slice(GOAL_SERIES_COLORS.length);
  const data: Record<string, number | string | null>[] = points.map((p, i) => {
    const row: Record<string, number | string | null> = { month: p.month, label: monthLabel(p.month, "short"), total: p.total, forecast: i === points.length - 1 && forecast.length ? p.total : null };
    for (const g of shown) row[g.id] = Math.max(0, p.byGoal[g.id] ?? 0);
    if (rest.length) row.other = rest.reduce((a, g) => a + Math.max(0, p.byGoal[g.id] ?? 0), 0);
    return row;
  });
  for (const f of forecast) data.push({ month: f.month, label: monthLabel(f.month, "short"), total: null, forecast: f.total, future: 1 });
  const maxY = Math.max(target ?? 0, ...data.map((d) => Number(d.total ?? 0)), ...data.map((d) => Number(d.forecast ?? 0)));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compact} width={48} domain={[0, Math.ceil((maxY * 1.05) / 50000) * 50000 || 1]} />
          {target !== undefined && target > 0 && <ReferenceLine y={target} stroke="var(--ink-3)" strokeDasharray="3 3" label={{ value: `all goals ${compact(target)}`, position: "insideTopLeft", fontSize: 11, fill: "var(--ink-3)" }} />}
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d) return null;
              if (d.future) return <TooltipBox title={`${monthLabel(String(d.month))} · forecast`} rows={[{ label: "At the current pace", value: fmtMoney(Number(d.forecast ?? 0), { whole: true }), color: "var(--save)" }]} />;
              return (
                <TooltipBox
                  title={monthLabel(String(d.month))}
                  rows={[
                    ...shown.map((g, i) => ({ label: g.name, value: fmtMoney(Number(d[g.id] ?? 0), { whole: true }), color: GOAL_SERIES_COLORS[i] })),
                    ...(rest.length ? [{ label: "Other goals", value: fmtMoney(Number(d.other ?? 0), { whole: true }), color: GOAL_OTHER_COLOR }] : []),
                    { label: "Total", value: fmtMoney(Number(d.total ?? 0), { whole: true }) },
                  ]}
                />
              );
            }}
          />
          {shown.map((g, i) => (
            <Area key={g.id} type="monotone" dataKey={g.id} stackId="b" stroke="var(--card)" strokeWidth={1} fill={GOAL_SERIES_COLORS[i]} fillOpacity={0.9} isAnimationActive={false} connectNulls={false} />
          ))}
          {rest.length > 0 && <Area type="monotone" dataKey="other" stackId="b" stroke="var(--card)" strokeWidth={1} fill={GOAL_OTHER_COLOR} fillOpacity={0.9} isAnimationActive={false} />}
          {forecast.length > 0 && <Line type="monotone" dataKey="forecast" stroke="var(--save)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
