"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtMoney, fmtPct } from "@/lib/money";
import { monthLabel } from "@/lib/dates";
import type { CategoryDetail } from "@/lib/details";
import { Explain } from "@/components/ui/Explain";
import { Icon } from "@/components/ui/Icon";
import { Empty, MemberDot } from "@/components/ui/Bits";
import { CategoryDetailSheet } from "@/components/plan/CategoryDetailSheet";
import { CashflowChart, GOAL_OTHER_COLOR, GOAL_SERIES_COLORS, KeptChart, SavingsBalanceChart, SavingsRateChart, type BalanceSeriesPoint, type KeptPoint, type TrendPoint } from "./Charts";

export interface CategoryRowLite {
  id: string;
  name: string;
  icon: string;
  spent: number;
  share: number;
  typicalShare: number | null;
  vsAvg: number | null;
  avg3: number;
}

export interface Comparison {
  basis: "avg3" | "month";
  rows: { id: string; name: string; icon: string; you: number; typical: number; scaled: number; estimated: boolean }[];
  youTotal: number;
  typicalTotal: number;
  profile: { id: string; label: string; short: string; source: string; year: string; persons: number; children: number; incomeBeforeTax: number };
}

export interface CompareRow {
  key: string;
  label: string;
  /** "spend": going up is bad. "gain": going up is good. */
  kind: "spend" | "gain";
  cur: number;
  prev: number | null;
  usual: number | null;
}

export interface Mover {
  categoryId: string;
  name: string;
  icon: string;
  before: number;
  after: number;
  delta: number;
}

export interface KeptSummary {
  months: number;
  total: number;
  avg: number;
  from: string;
}

export interface Ytd {
  year: string;
  months: number;
  income: number;
  spent: number;
  toGoals: number;
  kept: number;
}

export function InsightsScreen({
  month,
  today,
  monthStatus,
  dayOfMonth,
  daysInMonth,
  trend,
  kept,
  keptSummary,
  balances,
  goals,
  emergencyMonths,
  ytd,
  targetSavingsShare,
  categoryRows,
  details,
  totalSpent,
  members,
  avgSpend,
  avgRate,
  fullMonthCount,
  compare,
  comparison,
}: {
  month: string;
  today: string;
  monthStatus: "past" | "current" | "future";
  dayOfMonth: number;
  daysInMonth: number;
  trend: TrendPoint[];
  kept: KeptPoint[];
  keptSummary: KeptSummary | null;
  balances: BalanceSeriesPoint[];
  goals: { id: string; name: string; icon: string; isEmergency: boolean }[];
  emergencyMonths: number | null;
  ytd: Ytd;
  targetSavingsShare: number;
  categoryRows: CategoryRowLite[];
  details: CategoryDetail[];
  totalSpent: number;
  members: { id: string; name: string; color: string; spent: number; income: number; count: number }[];
  avgSpend: number | null;
  avgRate: number | null;
  fullMonthCount: number;
  compare: { prevMonth: string | null; rows: CompareRow[]; movers: Mover[] };
  comparison: Comparison;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refMode, setRefMode] = useState<"dollars" | "scaled">("dollars");
  const hasHistory = trend.length >= 2;
  const hasBusiness = trend.some((p) => p.business > 0);
  const spenders = members.filter((m) => m.spent > 0);
  const memberTotal = spenders.reduce((a, m) => a + m.spent, 0);
  const p = comparison.profile;
  const who = p.label.replace(/^Average /, "");

  const balanceNow = balances.length ? balances[balances.length - 1].total : 0;
  const balanceFirst = balances.length ? balances[0].total : 0;
  const balanceDelta = balanceNow - balanceFirst;
  const ups = compare.movers.filter((m) => m.delta > 0).slice(0, 3);
  const downs = compare.movers.filter((m) => m.delta < 0).slice(0, 3);

  // You vs typical: straight dollars, or the reference household's mix applied to your own total.
  const refRows = comparison.rows.map((r) => ({ ...r, ref: refMode === "dollars" ? r.typical : r.scaled }));
  const refMax = Math.max(1, ...refRows.flatMap((r) => [r.you, r.ref]));
  const refTotal = refMode === "dollars" ? comparison.typicalTotal : comparison.youTotal;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <Tile label={`Avg monthly spend · ${fullMonthCount || 0} mo`} value={avgSpend !== null ? fmtMoney(avgSpend, { whole: true }) : "—"} hint={avgSpend === null ? "Needs a full month of data" : undefined} />
        <Tile
          label={`Avg savings rate · ${fullMonthCount || 0} mo`}
          value={avgRate !== null ? fmtPct(avgRate) : "—"}
          hint={avgRate === null ? "Log income to see this" : avgRate >= targetSavingsShare ? `At or above your ${fmtPct(targetSavingsShare)} target` : `Target ${fmtPct(targetSavingsShare)}`}
          tone={avgRate === null ? "neutral" : avgRate >= targetSavingsShare ? "good" : "watch"}
        />
        <Tile label={`Put into goals · ${ytd.year}`} value={fmtMoney(ytd.toGoals, { whole: true })} hint={ytd.months ? `${ytd.months} month${ytd.months === 1 ? "" : "s"} · kept ${fmtMoney(ytd.kept, { whole: true, signed: true })} overall` : "Nothing logged this year yet"} tone={ytd.toGoals > 0 ? "good" : "neutral"} />
        {emergencyMonths !== null ? (
          <Tile
            label="Emergency fund"
            value={`${emergencyMonths >= 10 ? Math.round(emergencyMonths) : emergencyMonths.toFixed(1)} mo`}
            hint={emergencyMonths >= 6 ? "6+ months of needs: fully funded" : emergencyMonths >= 3 ? "3–6 months of needs: solid" : "Experts suggest 3–6 months of needs"}
            tone={emergencyMonths >= 3 ? "good" : "watch"}
          />
        ) : (
          <Tile label="Savings balance" value={goals.length ? fmtMoney(balanceNow, { whole: true }) : "—"} hint={goals.length ? `${goals.length} goal${goals.length === 1 ? "" : "s"}` : "Add a goal on the Goals tab"} />
        )}
      </div>

      <section className="rounded-card bg-card p-4 shadow-card">
        <header className="mb-1 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Are we getting ahead?</h2>
          <Explain title="Are we getting ahead?">
            <p>Each bar is one month: income minus needs, wants and business. Green means you ended the month with money left; red means you spent more than you earned.</p>
            <p>Months with no income logged are left blank instead of showing as a loss. The current month is still filling up, so judge it last.</p>
          </Explain>
        </header>
        {keptSummary ? (
          <p className="mb-3 text-sm text-ink-2">
            Over {keptSummary.months} full month{keptSummary.months === 1 ? "" : "s"} since {monthLabel(keptSummary.from)} you {keptSummary.total >= 0 ? "kept" : "overspent by"}{" "}
            <span className="num font-semibold text-ink">{fmtMoney(Math.abs(keptSummary.total), { whole: true })}</span>, about{" "}
            <span className="num font-semibold text-ink">{fmtMoney(Math.abs(keptSummary.avg), { whole: true })}</span> a month.
            {keptSummary.avg > 0 ? ` At that pace that is +${fmtMoney(keptSummary.avg * 12, { whole: true })} a year.` : keptSummary.avg < 0 ? " Spending is running ahead of income." : ""}
          </p>
        ) : (
          <p className="mb-3 text-sm text-ink-3">Finish a month with income logged and this fills in.</p>
        )}
        {kept.some((k) => k.kept !== null) ? <KeptChart points={kept} /> : null}
      </section>

      <section className="rounded-card bg-card p-4 shadow-card">
        <header className="mb-1 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Savings progress</h2>
          <Explain title="Savings progress">
            <p>The balance of every savings goal at the end of each month: its starting amount plus what you moved in, minus what you took out. The Tithe fund is not savings, so it is left out.</p>
            <p>The top edge is your total. A rising line is progress even when a single month was flat.</p>
          </Explain>
        </header>
        {goals.length === 0 ? (
          <p className="text-sm text-ink-3">
            Add a savings goal on the{" "}
            <Link href="/goals" className="font-medium text-green-text underline-offset-2 hover:underline">
              Goals tab
            </Link>{" "}
            and the balance shows up here month by month.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-2">
              <span className="num font-semibold text-ink">{fmtMoney(balanceNow, { whole: true })}</span> across {goals.length} goal{goals.length === 1 ? "" : "s"}
              {balances.length >= 2 && balanceDelta !== 0 && (
                <>
                  , <span className={`num font-semibold ${balanceDelta > 0 ? "text-green-text" : "text-over"}`}>{fmtMoney(balanceDelta, { whole: true, signed: true })}</span> since {monthLabel(balances[0].month)}
                </>
              )}
              .
            </p>
            <Legend
              items={[
                ...goals.slice(0, GOAL_SERIES_COLORS.length).map((g, i) => ({ label: g.name, color: GOAL_SERIES_COLORS[i] })),
                ...(goals.length > GOAL_SERIES_COLORS.length ? [{ label: "Other goals", color: GOAL_OTHER_COLOR }] : []),
              ]}
            />
            <SavingsBalanceChart points={balances} goals={goals} />
          </>
        )}
      </section>

      <section className="rounded-card bg-card p-4 shadow-card">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Income vs spending</h2>
          <Explain title="Income vs spending">
            <p>Each column is a month of spending, stacked by bucket: needs, wants, saving (goal contributions plus savings categories) and, if you track it, business. The dot above is income logged that month.</p>
            <p>When the column stays under the dot, you kept money that month.</p>
          </Explain>
        </header>
        {hasHistory ? (
          <>
            <Legend
              items={[
                { label: "Needs", color: "var(--need)" },
                { label: "Wants", color: "var(--want)" },
                { label: "Saving", color: "var(--save)" },
                ...(hasBusiness ? [{ label: "Business", color: "var(--ink-3)" }] : []),
                { label: "Income", color: "var(--ink)", dot: true },
              ]}
            />
            <CashflowChart points={trend} />
          </>
        ) : (
          <p className="text-sm text-ink-3">Trends appear after a second month of entries.</p>
        )}
      </section>

      <section className="rounded-card bg-card p-4 shadow-card">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Savings rate</h2>
          <Explain title="Savings rate">
            <p>(Income − needs − wants − business) ÷ income, per month. It counts everything you didn&apos;t spend as saved, whether it went to a goal or just stayed in the account.</p>
            <p>The thin line is your target from Settings.</p>
          </Explain>
        </header>
        {hasHistory && trend.some((pt) => pt.savingsRate !== null) ? (
          <SavingsRateChart points={trend} target={targetSavingsShare} />
        ) : (
          <p className="text-sm text-ink-3">Log income for at least two months to see the trend.</p>
        )}
      </section>

      <section className="rounded-card bg-card p-4 shadow-card">
        <header className="mb-1 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{monthLabel(month, "short")} vs {compare.prevMonth ? monthLabel(compare.prevMonth, "short") : "last month"}</h2>
          <Explain title="This month vs last">
            <p>The same buckets side by side: this month, the month before, and your usual (the average of the last {fullMonthCount || 3} full months). The last column is the change from last month.</p>
            <p>For spending rows, red means more than last month. For income and goals, green means more.</p>
            <p>&quot;Biggest changes&quot; lists the categories that moved the most in dollars, so you can see what drove the month.</p>
          </Explain>
        </header>
        {monthStatus === "current" && (
          <p className="mb-2 text-xs text-ink-3">
            {monthLabel(month, "short")} is day {dayOfMonth} of {daysInMonth}, so its numbers are still growing.
          </p>
        )}
        {!compare.prevMonth && trend.length < 2 ? (
          <p className="text-sm text-ink-3">Comparisons start with a second month of entries.</p>
        ) : (
          <table className="mt-1 w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                <th className="pb-1.5 font-semibold" />
                <th className="pb-1.5 text-right font-semibold">{monthLabel(month, "short")}</th>
                <th className="pb-1.5 text-right font-semibold">{compare.prevMonth ? monthLabel(compare.prevMonth, "short") : "Prev"}</th>
                <th className="pb-1.5 text-right font-semibold">Usual</th>
                <th className="pb-1.5 text-right font-semibold">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {compare.rows.map((r) => {
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
        {(ups.length > 0 || downs.length > 0) && compare.prevMonth && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Biggest changes vs {monthLabel(compare.prevMonth, "short")}</p>
            <ul className="mt-2 divide-y divide-line">
              {[...ups, ...downs].map((m) => (
                <li key={m.categoryId}>
                  <button type="button" onClick={() => setDetailId(m.categoryId)} className="flex w-full items-center gap-2 py-2 text-left text-sm">
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
      </section>

      <section className="rounded-card bg-card p-4 shadow-card">
        <header className="mb-1 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Where the money went</h2>
          <Explain title="Where the money went">
            <p>Each bar is a category&apos;s share of this month&apos;s spending. The small tick is the share a typical household spends on that kind of thing ({p.label}, {p.source} {p.year}).</p>
            <p>It&apos;s a reference, not a rule. Look for the categories where you&apos;re far from typical and ask whether it&apos;s on purpose. Tap a row for the breakdown.</p>
            <p>&quot;vs usual&quot; compares with your own 3-month average.</p>
          </Explain>
        </header>
        {categoryRows.length === 0 ? (
          <Empty title="No spending this month" />
        ) : (
          <ul className="mt-2 space-y-3">
            {categoryRows.slice(0, 12).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setDetailId(r.id)} className="w-full text-left">
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
                  <div className="relative mt-1 h-2 w-full rounded-full bg-card-2">
                    <div className="h-full rounded-full bg-green transition-[width] duration-500" style={{ width: `${Math.min(100, r.share * 100)}%` }} />
                    {r.typicalShare !== null && (
                      <span
                        title={`${p.short}: ${r.typicalShare}% of spending`}
                        className="absolute -top-1 h-4 w-0.5 rounded bg-ink/60"
                        style={{ left: `calc(${Math.min(100, r.typicalShare)}% - 1px)` }}
                        aria-label={`Typical household ${r.typicalShare}%`}
                      />
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {categoryRows.length > 0 && (
          <p className="mt-3 text-xs text-ink-3">
            <span className="mr-1 inline-block h-3 w-0.5 translate-y-0.5 rounded bg-ink/60" /> {p.short} share · total {fmtMoney(totalSpent, { whole: true })}
          </p>
        )}
      </section>

      <section className="rounded-card bg-card p-4 shadow-card">
        <header className="mb-1 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">You vs {p.short}</h2>
          <Explain title={`You vs ${p.short}`}>
            <p>
              &quot;Typical&quot; is the average {who} in the {p.source} ({p.year}): {p.persons} people including {p.children} children, income before taxes of {fmtMoney(p.incomeBeforeTax * 100, { whole: true })} a year, spending {fmtMoney(comparison.typicalTotal, { whole: true })} a month.
            </p>
            <p>&quot;You&quot; is your {comparison.basis === "avg3" ? `average over the last ${fullMonthCount} full month${fullMonthCount === 1 ? "" : "s"}` : "spending this month"} per category, business excluded.</p>
            <p>
              <strong className="font-semibold text-ink">In dollars</strong> compares raw amounts. <strong className="font-semibold text-ink">Scaled to your total</strong> asks a fairer question: if that household spent exactly what you spend in a month, how would it split the money? That shows where your mix differs from theirs even when your incomes don&apos;t match.
            </p>
            <p>Rows marked ~ are estimated: the survey publishes that group only as a total, so it was split using national proportions. A bigger family or a different city will sit above or below these on purpose. Change the reference household in Settings.</p>
          </Explain>
        </header>
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">Typical</span> = the average {who}: {p.persons} people, {fmtMoney(p.incomeBeforeTax * 100, { whole: true, compact: true })} before tax, {fmtMoney(comparison.typicalTotal, { whole: true })} spent a month.{" "}
          <span className="font-semibold text-ink">You</span> = your {comparison.basis === "avg3" ? `average over the last ${fullMonthCount} full month${fullMonthCount === 1 ? "" : "s"}` : "spending this month"}.
        </p>
        <div role="tablist" aria-label="Comparison mode" className="mt-3 flex rounded-xl bg-card-2 p-1 text-[13px] font-medium">
          {(["dollars", "scaled"] as const).map((m) => (
            <button key={m} role="tab" type="button" aria-selected={refMode === m} onClick={() => setRefMode(m)} className={`h-8 flex-1 rounded-lg px-3 ${refMode === m ? "bg-card text-ink shadow-sm" : "text-ink-2"}`}>
              {m === "dollars" ? "In dollars" : "Scaled to your total"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {refMode === "dollars"
            ? `Raw amounts. That household spends ${fmtMoney(comparison.typicalTotal, { whole: true })} a month against your ${fmtMoney(comparison.youTotal, { whole: true })}, so rows will sit ${comparison.typicalTotal > comparison.youTotal ? "above" : "below"} yours overall.`
            : `How that household would split your ${fmtMoney(comparison.youTotal, { whole: true })} a month. Differences here are about the mix, not the amount.`}
        </p>
        {refRows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Log a few expenses to compare.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {refRows.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setDetailId(r.id)} className="w-full text-left">
                  <div className="flex items-center gap-2 text-[14px]">
                    <Icon name={r.icon} size={16} className="shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {r.name}
                      {r.estimated && <span className="text-ink-3"> ~</span>}
                    </span>
                    <DiffLabel you={r.you} ref={r.ref} />
                  </div>
                  <div className="mt-1 space-y-1">
                    <BarLine label="You" value={r.you} max={refMax} color="var(--green)" />
                    <BarLine label="Typical" value={r.ref} max={refMax} color="var(--ink-3)" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {refRows.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-line-strong pt-3 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">All spending</span>
            <span className="num">
              You <span className="font-semibold text-ink">{fmtMoney(comparison.youTotal, { whole: true })}</span>
              <span className="text-ink-3"> · </span>
              Typical <span className="font-semibold text-ink">{fmtMoney(refTotal, { whole: true })}</span>
            </span>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-3">
          {p.label} · {p.source}, {p.year}.{" "}
          <Link href="/settings" className="font-medium text-green-text underline-offset-2 hover:underline">
            Change reference
          </Link>
        </p>
      </section>

      {members.length > 1 && (
        <section className="rounded-card bg-card p-4 shadow-card">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Who logged what</h2>
            <Explain title="Who logged what">
              <p>Spending this month by the member who entered it (or was marked as &quot;paid by&quot;). It&apos;s about visibility, not blame: shared bills usually land on one person.</p>
            </Explain>
          </header>
          {memberTotal === 0 ? (
            <p className="text-sm text-ink-3">No spending logged yet this month.</p>
          ) : (
            <>
              <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-card-2">
                {spenders.map((m) => (
                  <div key={m.id} title={`${m.name}: ${fmtMoney(m.spent)}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(m.spent / memberTotal) * 100}%`, backgroundColor: m.color }} />
                ))}
              </div>
              <ul className="mt-3 space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <MemberDot color={m.color} name={m.name} size="sm" />
                    <span className="flex-1 font-medium">{m.name}</span>
                    <span className="text-xs text-ink-3">{m.count} entr{m.count === 1 ? "y" : "ies"}</span>
                    <span className="num w-20 text-right font-semibold">{fmtMoney(m.spent, { whole: true })}</span>
                    <span className="num w-10 text-right text-xs text-ink-3">{memberTotal ? fmtPct(m.spent / memberTotal) : "—"}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <CategoryDetailSheet detail={details.find((d) => d.id === detailId) ?? null} onClose={() => setDetailId(null)} today={today} />
    </div>
  );
}

/** "+$120 more" / "$80 less" / "about the same", judged against the reference amount. */
function DiffLabel({ you, ref }: { you: number; ref: number }) {
  if (ref <= 0) return <span className="text-xs text-ink-3">no reference</span>;
  const pct = you / ref - 1;
  if (Math.abs(pct) < 0.1) return <span className="text-xs text-ink-3">about the same</span>;
  return pct > 0 ? (
    <span className="num text-xs font-medium text-over">+{fmtMoney(you - ref, { whole: true })} more</span>
  ) : (
    <span className="num text-xs font-medium text-green-text">{fmtMoney(ref - you, { whole: true })} less</span>
  );
}

function BarLine({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="grid grid-cols-[3.2rem_1fr_3.6rem] items-center gap-2 text-xs">
      <span className="text-ink-3">{label}</span>
      <div className="h-1.5 w-full rounded-full bg-card-2">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
      </div>
      <span className="num text-right text-ink-2">{fmtMoney(value, { whole: true })}</span>
    </div>
  );
}

function Tile({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "neutral" | "good" | "watch" }) {
  const cls = tone === "good" ? "text-green-text" : tone === "watch" ? "text-warn" : "text-ink";
  return (
    <div className="rounded-card bg-card px-4 py-3 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`display mt-0.5 text-2xl font-semibold tracking-tight ${cls}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; dot?: boolean }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={`inline-block ${i.dot ? "h-2.5 w-2.5 rounded-full" : "h-2.5 w-2.5 rounded-sm"}`} style={{ backgroundColor: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
