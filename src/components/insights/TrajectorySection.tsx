"use client";

import Link from "next/link";
import { ChevronRight, TrendingUp } from "lucide-react";
import { monthLabel } from "@/lib/dates";
import { fmtMoney, fmtPct } from "@/lib/money";
import { Icon } from "@/components/ui/Icon";
import { CashflowChart, GOAL_OTHER_COLOR, GOAL_SERIES_COLORS, KeptChart, SavingsBalanceChart } from "./Charts";
import { FIXED_COLORS, FixedFlexChart, Sparkline } from "./TrendCharts";
import { Legend, Section } from "./Shared";
import type { InsightsData } from "./types";

export function TrajectorySection({ d, onTrend }: { d: InsightsData; onTrend: (id: string) => void }) {
  const hasHistory = d.trend.length >= 2;
  const hasBusiness = d.trend.some((p) => p.business > 0);
  const balanceNow = d.balances.length ? d.balances[d.balances.length - 1].total : 0;
  const balanceFirst = d.balances.length ? d.balances[0].total : 0;
  const balanceDelta = balanceNow - balanceFirst;
  const forecastEnd = d.forecast.length ? d.forecast[d.forecast.length - 1] : null;
  const fixedFull = d.fixedFlex.filter((p) => p.month < d.currentMonth && p.income > 0);
  const fixedShare = d.tiles.fixedShare;
  const ks = d.keptSummary;

  return (
    <div id="trajectory" className="scroll-mt-24 space-y-4">
      <Section
        title="Are we getting ahead?"
        explain={
          <>
            <p>Each bar is one month: income minus needs, wants and business. Green means you ended the month with money left; red means you spent more than you earned.</p>
            <p>Months with no income logged are left blank instead of showing as a loss. The current month is still filling up, so the sentence above the chart only counts full months.</p>
          </>
        }
      >
        {ks ? (
          <p className="mb-3 text-sm text-ink-2">
            Over {ks.months} full month{ks.months === 1 ? "" : "s"} since {monthLabel(ks.from)} you {ks.total >= 0 ? "kept" : "overspent by"} <span className="num font-semibold text-ink">{fmtMoney(Math.abs(ks.total), { whole: true })}</span>, about{" "}
            <span className="num font-semibold text-ink">{fmtMoney(Math.abs(ks.avg), { whole: true })}</span> a month.
            {ks.avg > 0 ? ` At that pace that is +${fmtMoney(ks.avg * 12, { whole: true })} a year.` : ks.avg < 0 ? " Spending is running ahead of income." : ""}
            {d.monthStatus === "current" && ` ${monthLabel(d.month, "short")} is still in progress.`}
          </p>
        ) : (
          <p className="mb-3 text-sm text-ink-3">Finish a month with income logged and this fills in.</p>
        )}
        {d.kept.some((k) => k.kept !== null) && <KeptChart points={d.kept} />}
      </Section>

      <Section
        title="Savings and goals"
        explain={
          <>
            <p>The balance of every savings goal at the end of each month: its starting amount plus what you moved in, minus what you took out. The Tithe fund is not savings, so it is left out.</p>
            <p>The dashed line continues at your average monthly contribution over this window; nothing more, nothing less. The thin line marks the sum of all goal targets.</p>
          </>
        }
      >
        {d.goals.length === 0 ? (
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
              <span className="num font-semibold text-ink">{fmtMoney(balanceNow, { whole: true })}</span> across {d.goals.length} goal{d.goals.length === 1 ? "" : "s"}
              {d.balances.length >= 2 && balanceDelta !== 0 && (
                <>
                  , <span className={`num font-semibold ${balanceDelta > 0 ? "text-green-text" : "text-over"}`}>{fmtMoney(balanceDelta, { whole: true, signed: true })}</span> since {monthLabel(d.balances[0].month)}
                </>
              )}
              .{forecastEnd && ` At this pace ${fmtMoney(forecastEnd.total, { whole: true })} by ${monthLabel(forecastEnd.month)}.`}
              {d.efEta && ` Emergency fund reaches 3 months of needs around ${d.efEta}.`}
            </p>
            <Legend
              items={[
                ...d.goals.slice(0, GOAL_SERIES_COLORS.length).map((g, i) => ({ label: g.name, color: GOAL_SERIES_COLORS[i] })),
                ...(d.goals.length > GOAL_SERIES_COLORS.length ? [{ label: "Other goals", color: GOAL_OTHER_COLOR }] : []),
                ...(d.forecast.length ? [{ label: "Forecast", color: "var(--save)", dashed: true }] : []),
              ]}
            />
            <SavingsBalanceChart points={d.balances} goals={d.goals} forecast={d.forecast} target={d.goalTarget} />
          </>
        )}
      </Section>

      <Section
        title="Spending mix over time"
        explain={
          <>
            <p>Each column is a month of spending, stacked by bucket: needs, wants, saving (goal contributions plus savings categories) and, if you track it, business. The dot above is income logged that month.</p>
            <p>When the column stays under the dot, you kept money that month. Watch the colors shift: wants growing while income stays flat is the usual early warning.</p>
          </>
        }
      >
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
            <CashflowChart points={d.trend} />
          </>
        ) : (
          <p className="text-sm text-ink-3">Trends appear after a second month of entries.</p>
        )}
      </Section>

      <Section
        title="Category trends"
        explain={
          <>
            <p>Your six biggest categories over this window. The line is month by month; the number is the last full month and how it compares with the window average.</p>
            <p>&quot;↑ 3 mo&quot; means three months of growth in a row. Tap a category to see which subcategory is moving: which car, which child, which kind of groceries.</p>
          </>
        }
      >
        {d.categoryTrends.length === 0 ? (
          <p className="text-sm text-ink-3">Trends appear after a second month of entries.</p>
        ) : (
          <ul className="divide-y divide-line">
            {d.categoryTrends.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onTrend(t.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <Icon name={t.icon} size={18} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{t.name}</span>
                    <span className="block text-xs text-ink-3">
                      avg {fmtMoney(t.avg, { whole: true })}/mo
                      {t.streak >= 2 && (
                        <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-warn-soft px-1.5 py-px text-[11px] font-medium text-warn">
                          <TrendingUp size={11} /> {t.streak} mo
                        </span>
                      )}
                    </span>
                  </span>
                  <Sparkline values={t.series} color={t.deltaPct !== null && t.deltaPct > 0.15 ? "var(--over)" : "var(--green)"} width={72} height={26} />
                  <span className="w-[4.6rem] shrink-0 text-right">
                    <span className="num block text-sm font-semibold">{fmtMoney(t.last, { whole: true })}</span>
                    <span className={`num block text-xs ${t.deltaPct === null ? "text-ink-3" : t.deltaPct > 0.15 ? "text-over" : t.deltaPct < -0.15 ? "text-green-text" : "text-ink-3"}`}>
                      {t.deltaPct === null ? "—" : `${t.deltaPct > 0 ? "+" : ""}${fmtPct(t.deltaPct)} vs avg`}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-ink-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Fixed vs flexible"
        explain={
          <>
            <p>Fixed bills are the categories marked fixed in Settings (rent or mortgage, car payment and insurance, utilities, debt, subscriptions) plus the tithe set-aside. They are the hardest to change month to month.</p>
            <p>Flexible needs (groceries, gas, medical) and wants are where a month can actually be steered. The usual guideline keeps fixed bills at or under 50–60% of take-home income.</p>
          </>
        }
      >
        {fixedShare !== null ? (
          <p className="mb-3 text-sm text-ink-2">
            Fixed bills take <span className={`num font-semibold ${fixedShare > 0.6 ? "text-over" : fixedShare > 0.5 ? "text-warn" : "text-ink"}`}>{fmtPct(fixedShare)}</span> of income over {fixedFull.length} full month{fixedFull.length === 1 ? "" : "s"}
            {fixedShare > 0.6 ? ". Above 60%: every surprise lands on the flexible part." : fixedShare > 0.5 ? ". Right at the 50–60% ceiling." : ". Under the 50% guideline, so there is room to steer."}
          </p>
        ) : (
          <p className="mb-3 text-sm text-ink-3">Log income for a full month to see the fixed share.</p>
        )}
        {d.fixedFlex.length >= 2 && (
          <>
            <Legend
              items={[
                { label: "Fixed bills", color: FIXED_COLORS.fixed },
                { label: "Flexible needs", color: FIXED_COLORS.flexNeed },
                { label: "Wants", color: FIXED_COLORS.want },
                ...(d.fixedFlex.some((p) => p.business > 0) ? [{ label: "Business", color: FIXED_COLORS.business }] : []),
                { label: "Income", color: FIXED_COLORS.income, dot: true },
              ]}
            />
            <FixedFlexChart points={d.fixedFlex} />
          </>
        )}
      </Section>
    </div>
  );
}
