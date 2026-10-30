"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtMoney, fmtPct } from "@/lib/money";
import type { CategoryDetail } from "@/lib/details";
import { Explain } from "@/components/ui/Explain";
import { Icon } from "@/components/ui/Icon";
import { Empty, MemberDot } from "@/components/ui/Bits";
import { CategoryDetailSheet } from "@/components/plan/CategoryDetailSheet";
import { CashflowChart, SavingsRateChart, type TrendPoint } from "./Charts";

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
  rows: { id: string; name: string; icon: string; you: number; typical: number; estimated: boolean }[];
  youTotal: number;
  typicalTotal: number;
  profile: { id: string; label: string; short: string; source: string; year: string; persons: number; children: number; incomeBeforeTax: number };
}

export function InsightsScreen({
  today,
  trend,
  targetSavingsShare,
  categoryRows,
  details,
  totalSpent,
  members,
  avgSpend,
  avgRate,
  fullMonthCount,
  comparison,
}: {
  month: string;
  today: string;
  trend: TrendPoint[];
  targetSavingsShare: number;
  categoryRows: CategoryRowLite[];
  details: CategoryDetail[];
  totalSpent: number;
  members: { id: string; name: string; color: string; spent: number; income: number; count: number }[];
  avgSpend: number | null;
  avgRate: number | null;
  fullMonthCount: number;
  comparison: Comparison;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const hasHistory = trend.length >= 2;
  const hasBusiness = trend.some((p) => p.business > 0);
  const spenders = members.filter((m) => m.spent > 0);
  const memberTotal = spenders.reduce((a, m) => a + m.spent, 0);
  const p = comparison.profile;

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
      </div>

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
              &quot;You&quot; is your {comparison.basis === "avg3" ? "average over the last full months" : "spending this month"} per category. &quot;Typical&quot; is what the {p.label.toLowerCase()} spends per month: {p.source} ({p.year}), average of {p.persons} people ({p.children} children) with income before taxes of {fmtMoney(p.incomeBeforeTax * 100, { whole: true })} a year.
            </p>
            <p>Rows marked ~ are estimated: the survey publishes that group only as a total, so it was split using national proportions.</p>
            <p>A bigger family or a different city will sit above or below these on purpose. Change the reference household in Settings.</p>
          </Explain>
        </header>
        {comparison.rows.length === 0 ? (
          <p className="text-sm text-ink-3">Log a few expenses to compare.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                <th className="pb-1.5 font-semibold">Category</th>
                <th className="pb-1.5 text-right font-semibold">You /mo</th>
                <th className="pb-1.5 text-right font-semibold">Typical</th>
                <th className="pb-1.5 text-right font-semibold">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {comparison.rows.map((r) => {
                const diff = r.typical > 0 ? r.you / r.typical - 1 : null;
                return (
                  <tr key={r.id}>
                    <td className="py-2 pr-2">
                      <button type="button" onClick={() => setDetailId(r.id)} className="flex items-center gap-1.5 text-left">
                        <Icon name={r.icon} size={14} className="shrink-0 text-ink-3" />
                        <span className="truncate">{r.name}</span>
                        {r.estimated && <span className="text-ink-3">~</span>}
                      </button>
                    </td>
                    <td className="num py-2 text-right font-semibold">{fmtMoney(r.you, { whole: true })}</td>
                    <td className="num py-2 text-right text-ink-2">{fmtMoney(r.typical, { whole: true })}</td>
                    <td className={`num py-2 text-right text-xs ${diff === null ? "text-ink-3" : diff > 0.15 ? "text-over" : diff < -0.15 ? "text-green-text" : "text-ink-3"}`}>
                      {diff === null ? "—" : `${diff > 0 ? "+" : ""}${fmtPct(diff)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong">
                <td className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">All spending</td>
                <td className="num pt-2 text-right font-semibold">{fmtMoney(comparison.youTotal, { whole: true })}</td>
                <td className="num pt-2 text-right text-ink-2">{fmtMoney(comparison.typicalTotal, { whole: true })}</td>
                <td className="num pt-2 text-right text-xs text-ink-3">
                  {comparison.typicalTotal > 0 ? `${comparison.youTotal / comparison.typicalTotal - 1 > 0 ? "+" : ""}${fmtPct(comparison.youTotal / comparison.typicalTotal - 1)}` : ""}
                </td>
              </tr>
            </tfoot>
          </table>
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
