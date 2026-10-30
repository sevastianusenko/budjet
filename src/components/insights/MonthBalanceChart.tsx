"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthLabel } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import type { DayBalance } from "@/lib/trends";
import { axisTick, compactSigned, TooltipBox } from "./TrendCharts";

export const BALANCE_COLORS = { up: "var(--save)", down: "var(--over)", prev: "var(--ink-3)" };

/**
 * The month's running balance: income received so far minus money spent so far, day by day.
 * Green while above zero, red below; last month's path runs underneath as a dashed line.
 */
export function MonthBalanceChart({ month, points, prev, prevMonth, daysInMonth }: { month: string; points: DayBalance[]; prev: DayBalance[] | null; prevMonth: string | null; daysInMonth: number }) {
  const days = Math.max(daysInMonth, prev?.length ?? 0);
  const byDay = new Map(points.map((p) => [p.day, p]));
  const prevByDay = new Map((prev ?? []).map((p) => [p.day, p.net]));
  const data = Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const p = byDay.get(day);
    return { day, net: p ? p.net : null, income: p?.income ?? 0, spent: p?.spent ?? 0, prevNet: prevByDay.get(day) ?? null };
  });
  const short = monthLabel(month, "short");
  const prevShort = prevMonth ? monthLabel(prevMonth, "short") : "";
  const last = points[points.length - 1];
  const ticks = [1, 5, 10, 15, 20, 25, days].filter((t, i, a) => t <= days && a.indexOf(t) === i && (t === days || days - t >= 3));

  // The gradients are sized to each path's own box, so the colour flips exactly at zero.
  const nets = points.map((p) => p.net);
  const netMax = nets.length ? Math.max(...nets) : 0;
  const netMin = nets.length ? Math.min(...nets) : 0;
  const fillTop = Math.max(0, netMax);
  const fillBottom = Math.min(0, netMin);
  const fillSplit = fillTop === fillBottom ? 1 : fillTop / (fillTop - fillBottom);
  const strokeSplit = netMax === netMin ? 1 : Math.min(1, Math.max(0, netMax / (netMax - netMin)));
  const solid = netMax < 0 || (netMax === 0 && netMin < 0) ? BALANCE_COLORS.down : BALANCE_COLORS.up;
  const fillId = `balance-fill-${month}`;
  const strokeId = `balance-stroke-${month}`;

  // Round ticks that always include zero: a 1 / 2 / 2.5 / 5 step, about four of them across the range.
  const seen = data.flatMap((d) => [d.net, d.prevNet]).filter((v): v is number => v !== null);
  const lo = Math.min(0, ...seen);
  const hi = Math.max(0, ...seen);
  const raw = (hi - lo || 100_000) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10;
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hi / step) * step;
  const yTicks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => yMin + i * step);

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset={fillSplit} style={{ stopColor: BALANCE_COLORS.up }} />
              <stop offset={fillSplit} style={{ stopColor: BALANCE_COLORS.down }} />
            </linearGradient>
            <linearGradient id={strokeId} x1="0" y1="0" x2="0" y2="1">
              <stop offset={strokeSplit} style={{ stopColor: BALANCE_COLORS.up }} />
              <stop offset={strokeSplit} style={{ stopColor: BALANCE_COLORS.down }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeWidth={1} />
          <XAxis dataKey="day" type="number" domain={[1, days]} ticks={ticks} tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compactSigned} width={52} domain={[yMin, yMax]} ticks={yTicks} />
          <ReferenceLine y={0} stroke="var(--line-strong)" strokeWidth={1} />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p.active || !d) return null;
              const rows: { label: string; value: string; color?: string }[] = [];
              if (d.net !== null) {
                rows.push(
                  { label: "Income so far", value: fmtMoney(d.income, { whole: true }), color: "var(--ink)" },
                  { label: "Spent so far", value: fmtMoney(d.spent, { whole: true }), color: "var(--want)" },
                  { label: "Balance", value: fmtMoney(d.net, { whole: true, signed: true }), color: d.net < 0 ? BALANCE_COLORS.down : BALANCE_COLORS.up },
                );
              }
              if (d.prevNet !== null && prevShort) rows.push({ label: `${prevShort} by day ${d.day}`, value: fmtMoney(d.prevNet, { whole: true, signed: true }), color: BALANCE_COLORS.prev });
              if (!rows.length) return null;
              return <TooltipBox title={`${short} ${d.day}`} rows={rows} />;
            }}
          />
          {prev && <Line type="linear" dataKey="prevNet" stroke={BALANCE_COLORS.prev} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 4, fill: BALANCE_COLORS.prev, stroke: "var(--card)", strokeWidth: 2 }} connectNulls isAnimationActive={false} />}
          <Area
            type="linear"
            dataKey="net"
            baseValue={0}
            stroke={netMax === netMin ? solid : `url(#${strokeId})`}
            strokeWidth={2}
            fill={fillTop === fillBottom ? solid : `url(#${fillId})`}
            fillOpacity={0.16}
            dot={false}
            activeDot={{ r: 5, fill: "var(--ink)", stroke: "var(--card)", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          {last && <ReferenceDot x={last.day} y={last.net} r={4.5} fill={last.net < 0 ? BALANCE_COLORS.down : BALANCE_COLORS.up} stroke="var(--card)" strokeWidth={2} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
