"use client";

import { useState } from "react";
import { fmtMoney, fmtPct } from "@/lib/money";
import { monthLabel } from "@/lib/dates";
import { Sheet } from "@/components/ui/Sheet";
import { InsightCards } from "@/components/home/InsightCards";
import { CategoryDetailSheet } from "@/components/plan/CategoryDetailSheet";
import { Icon } from "@/components/ui/Icon";
import { Sparkline } from "./TrendCharts";
import { SubLinesChart, SUB_COLORS, SUB_OTHER } from "./SubLinesChart";
import { Legend, Tile } from "./Shared";
import { WindowChips } from "./WindowChips";
import { TrajectorySection } from "./TrajectorySection";
import { MoneySection } from "./MoneySection";
import { MonthSection } from "./MonthSection";
import { BenchmarkSection } from "./BenchmarkSection";
import { FamilySection } from "./FamilySection";
import type { InsightsData } from "./types";

const NAV = [
  { href: "#trajectory", label: "Trends" },
  { href: "#money", label: "Money" },
  { href: "#month", label: "This month" },
  { href: "#compare", label: "Compare" },
  { href: "#ours", label: "Ours" },
];

export function InsightsScreen({ d }: { d: InsightsData }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [trendId, setTrendId] = useState<string | null>(null);
  const [moreInsights, setMoreInsights] = useState(false);
  const t = d.tiles;
  const trend = d.categoryTrends.find((x) => x.id === trendId) ?? null;
  const shownInsights = moreInsights ? d.insights : d.insights.slice(0, 3);
  const hasOurs = Boolean(d.giving || d.business);

  return (
    <div className="space-y-5">
      <WindowChips value={d.window} />

      <div className="grid grid-cols-2 gap-2">
        <Tile
          label={`Savings rate · ${t.fullMonthCount || 0} mo`}
          value={t.avgRate !== null ? fmtPct(t.avgRate) : "—"}
          hint={t.avgRate === null ? "Log income to see this" : t.avgRate >= t.targetSavingsShare ? `At or above your ${fmtPct(t.targetSavingsShare)} target` : `Target ${fmtPct(t.targetSavingsShare)}`}
          tone={t.avgRate === null ? "neutral" : t.avgRate >= t.targetSavingsShare ? "good" : "watch"}
          extra={<Sparkline values={t.rateSeries} color={t.avgRate !== null && t.avgRate >= t.targetSavingsShare ? "var(--save)" : "var(--warn)"} width={64} height={24} baseline={t.targetSavingsShare} />}
        />
        {t.efMonths !== null ? (
          <Tile
            label="Emergency fund"
            value={`${t.efMonths >= 10 ? Math.round(t.efMonths) : t.efMonths.toFixed(1)} mo`}
            hint={t.efMonths >= 6 ? "6+ months of needs: fully funded" : t.efMonths >= 3 ? "3–6 months of needs: solid" : "Planners suggest 3–6 months of needs"}
            tone={t.efMonths >= 3 ? "good" : "watch"}
          />
        ) : (
          <Tile label="Savings balance" value={t.goalsCount ? fmtMoney(t.balanceNow, { whole: true }) : "—"} hint={t.goalsCount ? `${t.goalsCount} goal${t.goalsCount === 1 ? "" : "s"} · no emergency fund yet` : "Add a goal on the Goals tab"} />
        )}
        <Tile
          label="Fixed bills"
          value={t.fixedShare !== null ? fmtPct(t.fixedShare) : "—"}
          hint={t.fixedShare === null ? "Share of income, after a full month" : t.fixedShare > 0.6 ? "of income · above the 60% ceiling" : t.fixedShare > 0.5 ? "of income · at the 50–60% ceiling" : "of income · under the 50% guideline"}
          tone={t.fixedShare === null ? "neutral" : t.fixedShare > 0.6 ? "bad" : t.fixedShare > 0.5 ? "watch" : "good"}
        />
        <Tile
          label={`Kept in ${t.ytd.year}`}
          value={fmtMoney(t.ytd.kept, { whole: true, signed: true })}
          hint={t.ytd.months ? `${t.ytd.months} month${t.ytd.months === 1 ? "" : "s"} · ${fmtMoney(t.ytd.toGoals, { whole: true })} put into goals` : "Nothing logged this year yet"}
          tone={t.ytd.months === 0 ? "neutral" : t.ytd.kept >= 0 ? "good" : "bad"}
        />
      </div>

      {d.insights.length > 0 && (
        <div>
          <InsightCards insights={shownInsights} title="What changed" />
          {d.insights.length > 3 && (
            <button type="button" onClick={() => setMoreInsights((v) => !v)} className="mt-2 px-1 text-sm font-medium text-green-text">
              {moreInsights ? "Show fewer" : `Show ${d.insights.length - 3} more`}
            </button>
          )}
        </div>
      )}

      <nav aria-label="Sections" className="no-print -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {NAV.filter((n) => n.href !== "#ours" || hasOurs).map((n) => (
          <a key={n.href} href={n.href} className="shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-card-2">
            {n.label}
          </a>
        ))}
      </nav>

      <TrajectorySection d={d} onTrend={setTrendId} />
      <MoneySection d={d} onDetail={setDetailId} />
      <MonthSection d={d} onDetail={setDetailId} />
      <BenchmarkSection d={d} onDetail={setDetailId} />
      <FamilySection d={d} />

      <CategoryDetailSheet detail={d.details.find((x) => x.id === detailId) ?? null} onClose={() => setDetailId(null)} today={d.today} />

      <Sheet open={trend !== null} onClose={() => setTrendId(null)} title={trend ? trend.name : ""}>
        {trend && (
          <div className="space-y-3 pb-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card-2 text-ink-2">
                <Icon name={trend.icon} size={20} />
              </span>
              <p className="text-sm text-ink-2">
                <span className="num font-semibold text-ink">{fmtMoney(trend.total, { whole: true })}</span> over {d.months.length} months, <span className="num font-semibold text-ink">{fmtMoney(trend.avg, { whole: true })}</span> a month on average.
                {trend.deltaPct !== null && ` Last full month ${trend.deltaPct > 0 ? "+" : ""}${fmtPct(trend.deltaPct)} vs that average.`}
                {trend.streak >= 2 && ` Up ${trend.streak} months in a row.`}
              </p>
            </div>
            {trend.subs.length > 1 || (trend.subs.length === 1 && trend.subs[0].id !== null) ? (
              <>
                <Legend
                  items={[
                    ...trend.subs.slice(0, SUB_COLORS.length).map((s, i) => ({ label: s.name, color: SUB_COLORS[i] })),
                    ...(trend.subs.length > SUB_COLORS.length ? [{ label: "Other", color: SUB_OTHER, dashed: true }] : []),
                  ]}
                />
                <SubLinesChart months={d.months} subs={trend.subs} />
                <ul className="divide-y divide-line text-sm">
                  {trend.subs.map((s, i) => (
                    <li key={s.id ?? "none"} className="flex items-center gap-2 py-2">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: i < SUB_COLORS.length ? SUB_COLORS[i] : SUB_OTHER }} />
                      <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                      <span className="num text-xs text-ink-3">{fmtMoney(Math.round(s.total / Math.max(1, d.months.length)), { whole: true })}/mo</span>
                      <span className="num w-20 text-right font-semibold">{fmtMoney(s.total, { whole: true })}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <SubLinesChart months={d.months} subs={[{ id: null, name: trend.name, series: trend.series, total: trend.total }]} />
                <p className="text-sm text-ink-3">No subcategories here yet. Add some in Settings → Categories to see which part of {trend.name} is moving.</p>
              </>
            )}
            <p className="text-xs text-ink-3">
              {d.months.map((m) => monthLabel(m, "short")).join(" · ")}
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
