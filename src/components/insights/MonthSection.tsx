"use client";

import { useState } from "react";
import { monthLabel } from "@/lib/dates";
import { fmtMoney, fmtPct } from "@/lib/money";
import { Icon } from "@/components/ui/Icon";
import { Empty } from "@/components/ui/Bits";
import { SpendingDonut, sliceColors } from "./TrendCharts";
import { Section, Segmented } from "./Shared";
import type { InsightsData } from "./types";

export function MonthSection({ d, onDetail }: { d: InsightsData; onDetail: (id: string) => void }) {
  const [view, setView] = useState<"list" | "pie">("list");
  const ups = d.compare.movers.filter((m) => m.delta > 0).slice(0, 3);
  const downs = d.compare.movers.filter((m) => m.delta < 0).slice(0, 3);
  const short = monthLabel(d.month, "short");
  const colors = sliceColors(d.pie);

  return (
    <div id="month" className="scroll-mt-24 space-y-4">
      <Section
        title={`${short} vs ${d.compare.prevMonth ? monthLabel(d.compare.prevMonth, "short") : "last month"}`}
        explain={
          <>
            <p>The same buckets side by side: this month, the month before, and your usual (the average of the last {d.tiles.fullMonthCount || 3} full months). The last column is the change from last month.</p>
            <p>While a month is in progress it is compared with the previous month up to the same day, so day 12 is not judged against a whole month.</p>
            <p>For spending rows red means more than last month; for income and goals green means more. &quot;Biggest changes&quot; lists the categories that moved the most in dollars.</p>
          </>
        }
      >
        {d.monthStatus === "current" && (
          <p className="mb-2 text-xs text-ink-3">
            {short} is day {d.dayOfMonth} of {d.daysInMonth}; projected {fmtMoney(d.projectedSpend, { whole: true })} by month end. Compared with {d.compare.prevLabel}.
          </p>
        )}
        {!d.compare.prevMonth && d.trend.length < 2 ? (
          <p className="text-sm text-ink-3">Comparisons start with a second month of entries.</p>
        ) : (
          <table className="mt-1 w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                <th className="pb-1.5 font-semibold" />
                <th className="pb-1.5 text-right font-semibold">{short}</th>
                <th className="pb-1.5 text-right font-semibold">{d.compare.prevMonth ? monthLabel(d.compare.prevMonth, "short") : "Prev"}</th>
                <th className="pb-1.5 text-right font-semibold">Usual</th>
                <th className="pb-1.5 text-right font-semibold">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.compare.rows.map((r) => {
                const delta = r.prev === null ? null : r.cur - r.prev;
                const good = delta === null || delta === 0 ? null : r.kind === "spend" ? delta < 0 : delta > 0;
                const strong = r.key === "spent" || r.key === "income";
                return (
                  <tr key={r.key} className={strong ? "font-semibold" : ""}>
                    <td className="py-2 pr-2 text-ink">{r.label}</td>
                    <td className="num py-2 text-right">{fmtMoney(r.cur, { whole: true })}</td>
                    <td className="num py-2 text-right text-ink-2">{r.prev === null ? "—" : fmtMoney(r.prev, { whole: true })}</td>
                    <td className="num py-2 text-right text-ink-2">{r.usual === null ? "—" : fmtMoney(r.usual, { whole: true })}</td>
                    <td className={`num py-2 text-right text-xs ${good === null ? "text-ink-3" : good ? "text-green-text" : "text-over"}`}>{delta === null ? "—" : fmtMoney(delta, { whole: true, signed: true })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {(ups.length > 0 || downs.length > 0) && d.compare.prevMonth && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Biggest changes vs {d.compare.prevLabel}</p>
            <ul className="mt-2 divide-y divide-line">
              {[...ups, ...downs].map((m) => (
                <li key={m.categoryId}>
                  <button type="button" onClick={() => onDetail(m.categoryId)} className="flex w-full items-center gap-2 py-2 text-left text-sm">
                    <Icon name={m.icon} size={16} className="shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.name}</span>
                      <span className="num block text-xs text-ink-3">
                        {fmtMoney(m.before, { whole: true })} → {fmtMoney(m.after, { whole: true })}
                      </span>
                    </span>
                    <span className={`num text-sm font-semibold ${m.delta > 0 ? "text-over" : "text-green-text"}`}>{fmtMoney(m.delta, { whole: true, signed: true })}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section
        title="Where the money went"
        explain={
          <>
            <p>This month&apos;s spending by category. The list shows each category&apos;s share of the total and how it compares with your own 3-month average (&quot;vs usual&quot;).</p>
            <p>The pie is the same data as one picture: needs in blue, wants in orange, saving in green, each shade a category. Tap a category for its subcategories and receipt items.</p>
          </>
        }
        aside={<Segmented size="xs" ariaLabel="Spending view" value={view} onChange={setView} options={[{ id: "list", label: "List" }, { id: "pie", label: "Pie" }]} />}
      >
        {d.categoryRows.length === 0 ? (
          <Empty title="No spending this month" />
        ) : view === "pie" ? (
          <>
            <SpendingDonut slices={d.pie} total={d.totalSpent} />
            <ul className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              {d.pie.map((s, i) => (
                <li key={s.id}>
                  <button type="button" disabled={s.id === "other"} onClick={() => onDetail(s.id)} className="flex w-full items-center gap-2 py-1.5 text-left text-sm disabled:cursor-default">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colors[i] }} />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="num text-xs text-ink-3">{fmtPct(s.share)}</span>
                    <span className="num w-16 text-right font-semibold">{fmtMoney(s.value, { whole: true })}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <ul className="mt-1 space-y-3">
              {d.categoryRows.slice(0, 12).map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => onDetail(r.id)} className="w-full text-left">
                    <div className="flex items-center gap-2 text-[14px]">
                      <Icon name={r.icon} size={16} className="shrink-0 text-ink-3" />
                      <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                      {r.vsAvg !== null && Math.abs(r.vsAvg) >= 0.15 && (
                        <span className={`num text-xs ${r.vsAvg > 0 ? "text-over" : "text-green-text"}`}>
                          {r.vsAvg > 0 ? "+" : ""}
                          {fmtPct(r.vsAvg)} vs usual
                        </span>
                      )}
                      <span className="num w-16 shrink-0 text-right text-sm font-semibold">{fmtMoney(r.spent, { whole: true })}</span>
                      <span className="num w-10 shrink-0 text-right text-xs text-ink-3">{fmtPct(r.share)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-card-2">
                      <div className="h-full rounded-full bg-green transition-[width] duration-500" style={{ width: `${Math.min(100, r.share * 100)}%` }} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-3">
              {d.categoryRows.length > 12 ? `Top 12 of ${d.categoryRows.length} categories · ` : ""}total {fmtMoney(d.totalSpent, { whole: true })}
            </p>
          </>
        )}
      </Section>
    </div>
  );
}
