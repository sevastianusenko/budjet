"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthLabel } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import type { SubSeries } from "@/lib/trends";
import { TooltipBox } from "./TrendCharts";

const axisTick = { fontSize: 11, fill: "var(--ink-3)", fontFamily: "var(--font-plex-mono)" } as const;
const compact = (c: number) => (c <= 0 ? "$0" : c < 100_000 ? `$${Math.round(c / 100)}` : `$${Math.round((c / 100_000) * 10) / 10}k`);

/** Fixed hue order for subcategory lines; the rest fold into "Other". */
export const SUB_COLORS = ["var(--green)", "var(--need)", "var(--want)", "var(--warn)", "var(--save)"];
export const SUB_OTHER = "var(--ink-3)";

/** One line per subcategory (which car, which child, which kind of food) across the window. */
export function SubLinesChart({ months, subs }: { months: string[]; subs: SubSeries[] }) {
  const shown = subs.slice(0, SUB_COLORS.length);
  const rest = subs.slice(SUB_COLORS.length);
  const key = (s: SubSeries) => s.id ?? "none";
  const data = months.map((m, i) => {
    const row: Record<string, number | string> = { month: m, label: monthLabel(m, "short") };
    for (const s of shown) row[key(s)] = s.series[i] ?? 0;
    if (rest.length) row.other = rest.reduce((a, s) => a + (s.series[i] ?? 0), 0);
    return row;
  });
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compact} width={48} />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d) return null;
              return (
                <TooltipBox
                  title={monthLabel(String(d.month))}
                  rows={[
                    ...shown.map((s, i) => ({ label: s.name, value: fmtMoney(Number(d[key(s)] ?? 0), { whole: true }), color: SUB_COLORS[i] })),
                    ...(rest.length ? [{ label: "Other", value: fmtMoney(Number(d.other ?? 0), { whole: true }), color: SUB_OTHER }] : []),
                  ]}
                />
              );
            }}
          />
          {shown.map((s, i) => (
            <Line key={key(s)} type="monotone" dataKey={key(s)} stroke={SUB_COLORS[i]} strokeWidth={2} dot={{ r: 3, fill: SUB_COLORS[i], stroke: "var(--card)", strokeWidth: 1.5 }} isAnimationActive={false} />
          ))}
          {rest.length > 0 && <Line type="monotone" dataKey="other" stroke={SUB_OTHER} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
