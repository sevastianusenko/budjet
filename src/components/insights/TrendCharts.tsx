"use client";

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { monthLabel } from "@/lib/dates";
import { fmtMoney, fmtPct } from "@/lib/money";
import type { BudgetPoint, BusinessPoint, FixedFlexPoint, GivingPoint, IncomePoint, IncomeSource, PieSlice, YearPoint } from "@/lib/trends";
import type { Group } from "@/lib/calc";

const axisTick = { fontSize: 11, fill: "var(--ink-3)", fontFamily: "var(--font-plex-mono)" } as const;
const compact = (c: number) => {
  if (c <= 0) return "$0";
  if (c < 100_000) return `$${Math.round(c / 100)}`;
  const k = c / 100_000;
  return `$${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
};
const compactSigned = (c: number) => (c < 0 ? `−${compact(-c)}` : compact(c));

export function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
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

/* ---------- Sparkline (plain SVG, no axes) ---------- */

export function Sparkline({ values, color = "var(--green)", width = 96, height = 28, baseline }: { values: (number | null)[]; color?: string; width?: number; height?: number; baseline?: number }) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...nums, baseline ?? Infinity);
  const max = Math.max(...nums, baseline ?? -Infinity);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => (v === null ? null : [i * step, height - 2 - ((v - min) / span) * (height - 4)] as const));
  const d = pts
    .map((p, i) => (p ? `${i === 0 || !pts[i - 1] ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}` : ""))
    .join(" ");
  const last = [...pts].reverse().find((p) => p !== null);
  const by = baseline !== undefined ? height - 2 - ((baseline - min) / span) * (height - 4) : null;
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      {by !== null && <line x1={0} x2={width} y1={by} y2={by} stroke="var(--line-strong)" strokeDasharray="2 3" />}
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={3} fill={color} stroke="var(--card)" strokeWidth={1.5} />}
    </svg>
  );
}

/* ---------- Fixed vs flexible ---------- */

export const FIXED_COLORS = { fixed: "var(--ink-2)", flexNeed: "var(--need)", want: "var(--want)", business: "var(--ink-3)", income: "var(--ink)" };

export function FixedFlexChart({ points }: { points: FixedFlexPoint[] }) {
  const data = points.map((p) => ({ ...p, label: monthLabel(p.month, "short"), incomeDot: p.income > 0 ? p.income : null }));
  const hasBusiness = points.some((p) => p.business > 0);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compact} width={48} />
          <Tooltip
            cursor={{ fill: "var(--card-2)" }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d) return null;
              const spent = d.fixed + d.flexNeed + d.want + d.business;
              return (
                <TooltipBox
                  title={monthLabel(d.month)}
                  rows={[
                    { label: "Fixed bills", value: fmtMoney(d.fixed, { whole: true }), color: FIXED_COLORS.fixed },
                    { label: "Flexible needs", value: fmtMoney(d.flexNeed, { whole: true }), color: FIXED_COLORS.flexNeed },
                    { label: "Wants", value: fmtMoney(d.want, { whole: true }), color: FIXED_COLORS.want },
                    ...(d.business > 0 ? [{ label: "Business", value: fmtMoney(d.business, { whole: true }), color: FIXED_COLORS.business }] : []),
                    { label: "Income", value: fmtMoney(d.income, { whole: true }), color: FIXED_COLORS.income },
                    { label: "Fixed share of income", value: d.income > 0 ? fmtPct(d.fixed / d.income) : "—" },
                    { label: "Left after everything", value: d.income > 0 ? fmtMoney(d.income - spent, { whole: true, signed: true }) : "—" },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="fixed" stackId="s" fill={FIXED_COLORS.fixed} maxBarSize={24} stroke="var(--card)" strokeWidth={1} isAnimationActive={false} />
          <Bar dataKey="flexNeed" stackId="s" fill={FIXED_COLORS.flexNeed} maxBarSize={24} stroke="var(--card)" strokeWidth={1} isAnimationActive={false} />
          <Bar dataKey="want" stackId="s" fill={FIXED_COLORS.want} maxBarSize={24} stroke="var(--card)" strokeWidth={1} radius={hasBusiness ? undefined : [4, 4, 0, 0]} isAnimationActive={false} />
          {hasBusiness && <Bar dataKey="business" stackId="s" fill={FIXED_COLORS.business} maxBarSize={24} stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} isAnimationActive={false} />}
          <Scatter dataKey="incomeDot" fill={FIXED_COLORS.income} stroke="var(--card)" strokeWidth={2} shape="circle" legendType="none" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Income by source ---------- */

export const INCOME_COLORS = ["var(--green)", "var(--need)", "var(--warn)", "var(--want)"];
export const INCOME_OTHER = "var(--ink-3)";

export function IncomeSourcesChart({ points, sources }: { points: IncomePoint[]; sources: IncomeSource[] }) {
  const shown = sources.slice(0, INCOME_COLORS.length);
  const rest = sources.slice(INCOME_COLORS.length);
  const data = points.map((p) => {
    const row: Record<string, number | string> = { month: p.month, label: monthLabel(p.month, "short"), total: p.total };
    for (const s of shown) row[s.id] = p.bySource[s.id] ?? 0;
    if (rest.length) row.other = rest.reduce((a, s) => a + (p.bySource[s.id] ?? 0), 0);
    return row;
  });
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compact} width={48} />
          <Tooltip
            cursor={{ fill: "var(--card-2)" }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d) return null;
              return (
                <TooltipBox
                  title={monthLabel(String(d.month))}
                  rows={[
                    ...shown.map((s, i) => ({ label: s.name, value: fmtMoney(Number(d[s.id] ?? 0), { whole: true }), color: INCOME_COLORS[i] })),
                    ...(rest.length ? [{ label: "Other", value: fmtMoney(Number(d.other ?? 0), { whole: true }), color: INCOME_OTHER }] : []),
                    { label: "Total", value: fmtMoney(Number(d.total), { whole: true }) },
                  ]}
                />
              );
            }}
          />
          {shown.map((s, i) => (
            <Bar key={s.id} dataKey={s.id} stackId="i" fill={INCOME_COLORS[i]} maxBarSize={24} stroke="var(--card)" strokeWidth={1} radius={i === shown.length - 1 && !rest.length ? [4, 4, 0, 0] : undefined} isAnimationActive={false} />
          ))}
          {rest.length > 0 && <Bar dataKey="other" stackId="i" fill={INCOME_OTHER} maxBarSize={24} stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} isAnimationActive={false} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Year in review ---------- */

export type YearMode = "all" | "income" | "spent" | "kept";

export function YearReviewChart({ points, mode }: { points: YearPoint[]; mode: YearMode }) {
  const data = points.map((p) => ({
    month: p.month,
    label: monthLabel(p.month, "short").slice(0, 1),
    income: p.future || p.income === 0 ? null : p.income,
    spent: p.future || p.spent === 0 ? null : p.spent,
    kept: p.kept,
    future: p.future,
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={mode === "all" ? "20%" : "28%"} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compactSigned} width={48} />
          {mode === "kept" && <ReferenceLine y={0} stroke="var(--line-strong)" strokeWidth={1} />}
          <Tooltip
            cursor={{ fill: "var(--card-2)" }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d || d.future) return null;
              return (
                <TooltipBox
                  title={monthLabel(d.month)}
                  rows={[
                    { label: "Income", value: fmtMoney(d.income ?? 0, { whole: true }), color: "var(--ink)" },
                    { label: "Spent", value: fmtMoney(d.spent ?? 0, { whole: true }), color: "var(--want)" },
                    { label: "Kept", value: d.kept === null ? "no income logged" : fmtMoney(d.kept, { whole: true, signed: true }), color: "var(--save)" },
                  ]}
                />
              );
            }}
          />
          {(mode === "all" || mode === "income") && <Bar dataKey="income" fill="var(--ink)" maxBarSize={mode === "all" ? 12 : 24} radius={[3, 3, 0, 0]} isAnimationActive={false} />}
          {(mode === "all" || mode === "spent") && <Bar dataKey="spent" fill="var(--want)" maxBarSize={mode === "all" ? 12 : 24} radius={[3, 3, 0, 0]} isAnimationActive={false} />}
          {mode === "kept" && (
            <Bar dataKey="kept" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.month} fill={d.kept !== null && d.kept < 0 ? "var(--over)" : "var(--save)"} />
              ))}
            </Bar>
          )}
          {mode === "all" && <Line type="monotone" dataKey="kept" stroke="var(--save)" strokeWidth={2} dot={{ r: 3, fill: "var(--save)", stroke: "var(--card)", strokeWidth: 1.5 }} connectNulls={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Plan vs actual ---------- */

export function BudgetVsActualChart({ points }: { points: BudgetPoint[] }) {
  const data = points.map((p) => ({ ...p, label: monthLabel(p.month, "short") }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="24%" barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compact} width={48} />
          <Tooltip
            cursor={{ fill: "var(--card-2)" }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d) return null;
              return (
                <TooltipBox
                  title={monthLabel(d.month)}
                  rows={[
                    { label: "Planned", value: fmtMoney(d.planned, { whole: true }), color: "var(--line-strong)" },
                    { label: "Spent", value: fmtMoney(d.spent, { whole: true }), color: "var(--green)" },
                    { label: d.spent > d.planned ? "Over plan" : "Under plan", value: fmtMoney(Math.abs(d.spent - d.planned), { whole: true }) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="planned" fill="var(--card-2)" stroke="var(--line-strong)" strokeWidth={1} maxBarSize={14} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="spent" maxBarSize={14} radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.month} fill={d.planned > 0 && d.spent > d.planned ? "var(--over)" : "var(--green)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Donut ---------- */

const GROUP_BASE: Record<Group | "other", string> = { need: "var(--need)", want: "var(--want)", savings: "var(--save)", business: "var(--ink-2)", income: "var(--green)", other: "var(--ink-3)" };

/** Slices share a hue per group (needs blue, wants orange, saving green) and step lighter within the group. */
export function sliceColors(slices: PieSlice[]): string[] {
  const seen: Record<string, number> = {};
  return slices.map((s) => {
    const i = seen[s.group] ?? 0;
    seen[s.group] = i + 1;
    const base = GROUP_BASE[s.group];
    return i === 0 ? base : `color-mix(in oklab, ${base} ${Math.max(35, 100 - i * 18)}%, var(--card))`;
  });
}

export function SpendingDonut({ slices, total }: { slices: PieSlice[]; total: number }) {
  const colors = sliceColors(slices);
  const data = slices.map((s, i) => ({ ...s, fill: colors[i] }));
  return (
    <div className="relative mx-auto h-52 w-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d) return null;
              return <TooltipBox title={d.name} rows={[{ label: "Spent", value: fmtMoney(d.value, { whole: true }), color: d.fill }, { label: "Share", value: fmtPct(d.share) }]} />;
            }}
          />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={1.5} stroke="var(--card)" strokeWidth={2} isAnimationActive={false} startAngle={90} endAngle={-270}>
            {data.map((d) => (
              <Cell key={d.id} fill={d.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Spent</span>
        <span className="display num text-xl font-semibold text-ink">{fmtMoney(total, { whole: true })}</span>
      </div>
    </div>
  );
}

/* ---------- Giving ---------- */

export function GivingChart({ points }: { points: GivingPoint[] }) {
  const data = points.map((p) => ({ ...p, label: monthLabel(p.month, "short"), given: p.fromFund + p.extra }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="24%" barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compact} width={48} />
          <Tooltip
            cursor={{ fill: "var(--card-2)" }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d) return null;
              return (
                <TooltipBox
                  title={monthLabel(d.month)}
                  rows={[
                    { label: "Set aside", value: fmtMoney(d.setAside, { whole: true }), color: "var(--need)" },
                    { label: "Given from the fund", value: fmtMoney(d.fromFund, { whole: true }), color: "var(--save)" },
                    { label: "Given from own money", value: fmtMoney(d.extra, { whole: true }), color: "var(--warn)" },
                    { label: "Fund balance", value: fmtMoney(d.fundBalance, { whole: true }), color: "var(--ink)" },
                    { label: "Share of income given", value: d.income > 0 ? fmtPct((d.fromFund + d.extra) / d.income) : "—" },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="setAside" fill="var(--need)" maxBarSize={14} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="fromFund" stackId="g" fill="var(--save)" maxBarSize={14} stroke="var(--card)" strokeWidth={1} isAnimationActive={false} />
          <Bar dataKey="extra" stackId="g" fill="var(--warn)" maxBarSize={14} stroke="var(--card)" strokeWidth={1} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line type="monotone" dataKey="fundBalance" stroke="var(--ink)" strokeWidth={2} dot={{ r: 3, fill: "var(--ink)", stroke: "var(--card)", strokeWidth: 1.5 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Business ---------- */

export function BusinessChart({ points }: { points: BusinessPoint[] }) {
  const data = points.map((p) => ({ ...p, label: monthLabel(p.month, "short") }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="24%" barGap={2}>
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
                    { label: "Business income", value: fmtMoney(d.income, { whole: true }), color: "var(--green)" },
                    { label: "Business expenses", value: fmtMoney(d.expenses, { whole: true }), color: "var(--ink-3)" },
                    { label: "Net", value: fmtMoney(d.net, { whole: true, signed: true }), color: d.net < 0 ? "var(--over)" : "var(--save)" },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="income" fill="var(--green)" maxBarSize={14} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expenses" fill="var(--ink-3)" maxBarSize={14} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line type="monotone" dataKey="net" stroke="var(--save)" strokeWidth={2} dot={{ r: 3, fill: "var(--save)", stroke: "var(--card)", strokeWidth: 1.5 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
