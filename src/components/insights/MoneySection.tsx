"use client";

import { useState } from "react";
import Link from "next/link";
import { monthLabel } from "@/lib/dates";
import { fmtMoney, fmtPct } from "@/lib/money";
import { Icon } from "@/components/ui/Icon";
import { BudgetVsActualChart, INCOME_COLORS, INCOME_OTHER, IncomeSourcesChart, YearReviewChart, type YearMode } from "./TrendCharts";
import { BarLine, Legend, Section, Segmented } from "./Shared";
import type { InsightsData } from "./types";

export function MoneySection({ d, onDetail }: { d: InsightsData; onDetail: (id: string) => void }) {
  const [budgetMode, setBudgetMode] = useState<"month" | "category">("month");
  const [yearMode, setYearMode] = useState<YearMode>("all");
  const incomeTotal = d.income.sources.reduce((a, s) => a + s.total, 0);
  const top = d.income.sources[0];
  const overPlan = d.budget.points.filter((p) => p.planned > 0 && p.spent > p.planned).length;
  const planned = d.budget.points.filter((p) => p.planned > 0);
  const y = d.year.totals;
  const prev = d.year.prev;
  const pct = (a: number, b: number) => (b > 0 ? a / b - 1 : null);
  const budgetMax = Math.max(1, ...d.budget.byCategory.flatMap((c) => [c.planned, c.spent]));

  return (
    <div id="money" className="scroll-mt-24 space-y-4">
      <Section
        title="Income by source"
        explain={
          <>
            <p>Every income entry, stacked by its category: paycheck, side income, business income and so on. The list below totals each source over the window.</p>
            <p>A household that leans on one source is more exposed than one with two. It also shows whether side or business income is actually growing.</p>
          </>
        }
      >
        {incomeTotal === 0 ? (
          <p className="text-sm text-ink-3">Log income with a category (Paycheck, Side Income, Business Income) to see where it comes from.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-2">
              <span className="num font-semibold text-ink">{fmtMoney(incomeTotal, { whole: true })}</span> over {d.months.length} month{d.months.length === 1 ? "" : "s"}
              {top && (
                <>
                  , <span className="font-semibold text-ink">{fmtPct(top.total / incomeTotal)}</span> from {top.name}
                </>
              )}
              .
            </p>
            <Legend
              items={[
                ...d.income.sources.slice(0, INCOME_COLORS.length).map((s, i) => ({ label: s.name, color: INCOME_COLORS[i] })),
                ...(d.income.sources.length > INCOME_COLORS.length ? [{ label: "Other", color: INCOME_OTHER }] : []),
              ]}
            />
            <IncomeSourcesChart points={d.income.points} sources={d.income.sources} />
            <ul className="mt-3 divide-y divide-line text-sm">
              {d.income.sources.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 py-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: i < INCOME_COLORS.length ? INCOME_COLORS[i] : INCOME_OTHER }} />
                  <Icon name={s.icon} size={16} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span className="num text-xs text-ink-3">{fmtMoney(Math.round(s.total / d.months.length), { whole: true })}/mo</span>
                  <span className="num w-20 text-right font-semibold">{fmtMoney(s.total, { whole: true })}</span>
                  <span className="num w-10 text-right text-xs text-ink-3">{fmtPct(s.total / incomeTotal)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section
        title="Plan vs actual"
        explain={
          <>
            <p>By month: the sum of your category plans for needs and wants next to what was actually spent. A red bar is a month that went over its plan.</p>
            <p>By category: this month&apos;s plan against spending for the biggest planned categories. The Plan tab has the full list and lets you change the numbers.</p>
          </>
        }
        aside={<Segmented size="xs" ariaLabel="Plan vs actual view" value={budgetMode} onChange={setBudgetMode} options={[{ id: "month", label: "By month" }, { id: "category", label: "By category" }]} />}
      >
        {budgetMode === "month" ? (
          planned.length === 0 ? (
            <p className="text-sm text-ink-3">
              No plans in this window yet. Set them on the{" "}
              <Link href="/plan" className="font-medium text-green-text underline-offset-2 hover:underline">
                Plan tab
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-2">
                {overPlan === 0 ? "Every planned month stayed under its plan." : `${overPlan} of ${planned.length} planned month${planned.length === 1 ? "" : "s"} went over plan.`}
              </p>
              <Legend items={[{ label: "Planned", color: "var(--line-strong)" }, { label: "Spent", color: "var(--green)" }, { label: "Over plan", color: "var(--over)" }]} />
              <BudgetVsActualChart points={d.budget.points} />
            </>
          )
        ) : d.budget.byCategory.length === 0 ? (
          <p className="text-sm text-ink-3">No plan for {monthLabel(d.month)} yet.</p>
        ) : (
          <ul className="space-y-3">
            {d.budget.byCategory.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onDetail(c.id)} className="w-full text-left">
                  <div className="flex items-center gap-2 text-[14px]">
                    <Icon name={c.icon} size={16} className="shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <span className={`num text-xs font-medium ${c.planned > 0 && c.spent > c.planned ? "text-over" : "text-ink-3"}`}>
                      {c.planned === 0 ? "no plan" : c.spent > c.planned ? `+${fmtMoney(c.spent - c.planned, { whole: true })} over` : `${fmtMoney(c.planned - c.spent, { whole: true })} left`}
                    </span>
                  </div>
                  <div className="mt-1 space-y-1">
                    <BarLine label="Plan" value={c.planned} max={budgetMax} color="var(--line-strong)" />
                    <BarLine label="Spent" value={c.spent} max={budgetMax} color={c.planned > 0 && c.spent > c.planned ? "var(--over)" : "var(--green)"} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={`Year in review · ${y.year}`}
        explain={
          <>
            <p>January to December of the selected year. Income and spending (needs, wants, business) per month, and what was kept. Months without income are not counted as losses.</p>
            <p>Below the chart: totals for the year and, once a second year has data, the change from the year before.</p>
          </>
        }
        aside={<Segmented size="xs" ariaLabel="Year view" value={yearMode} onChange={setYearMode} options={[{ id: "all", label: "All" }, { id: "income", label: "Income" }, { id: "spent", label: "Spending" }, { id: "kept", label: "Kept" }]} />}
      >
        {y.months === 0 ? (
          <p className="text-sm text-ink-3">Nothing logged in {y.year} yet.</p>
        ) : (
          <>
            {yearMode === "all" && <Legend items={[{ label: "Income", color: "var(--ink)" }, { label: "Spending", color: "var(--want)" }, { label: "Kept", color: "var(--save)", dot: true }]} />}
            <YearReviewChart points={d.year.points} mode={yearMode} />
            <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Income", value: fmtMoney(y.income, { whole: true, compact: true }), delta: prev ? pct(y.income, prev.income) : null, goodUp: true },
                { label: "Spent", value: fmtMoney(y.spent, { whole: true, compact: true }), delta: prev ? pct(y.spent, prev.spent) : null, goodUp: false },
                { label: "Kept", value: fmtMoney(y.kept, { whole: true, compact: true, signed: true }), delta: prev && prev.kept !== 0 ? pct(y.kept, prev.kept) : null, goodUp: true },
                { label: "Saved", value: y.savingsRate === null ? "—" : fmtPct(y.savingsRate), delta: null, goodUp: true },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-card-2 px-2 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">{s.label}</dt>
                  <dd className="num text-sm font-semibold text-ink">{s.value}</dd>
                  {s.delta !== null && <dd className={`num text-[11px] ${s.delta === 0 ? "text-ink-3" : (s.delta > 0) === s.goodUp ? "text-green-text" : "text-over"}`}>{`${s.delta > 0 ? "+" : ""}${fmtPct(s.delta)} vs ${prev!.year}`}</dd>}
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-ink-3">
              {y.months} month{y.months === 1 ? "" : "s"} with data{prev ? ` · ${prev.year}: ${fmtMoney(prev.income, { whole: true, compact: true })} in, ${fmtMoney(prev.spent, { whole: true, compact: true })} out` : ""}.{" "}
              <Link href={`/report?period=year&key=${y.year}`} className="font-medium text-green-text underline-offset-2 hover:underline">
                Printable report
              </Link>
            </p>
          </>
        )}
      </Section>
    </div>
  );
}
