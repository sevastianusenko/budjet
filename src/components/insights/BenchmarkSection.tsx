"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { fmtMoney, fmtPct } from "@/lib/money";
import { Icon } from "@/components/ui/Icon";
import { BarLine, DiffLabel, Section, Segmented, StatusDot } from "./Shared";
import type { InsightsData } from "./types";

export function BenchmarkSection({ d, onDetail }: { d: InsightsData; onDetail: (id: string) => void }) {
  const [refMode, setRefMode] = useState<"dollars" | "scaled">("dollars");
  const [showAll, setShowAll] = useState(false);
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [planId, setPlanId] = useState(d.plans[0]?.id ?? "ramsey");
  const c = d.comparison;
  const ref = c.ref;
  const rows = c.rows.map((r) => ({ ...r, ref: refMode === "dollars" ? r.typical : r.scaled }));
  const shown = showAll ? rows : rows.slice(0, 8);
  const max = Math.max(1, ...rows.flatMap((r) => [r.you, r.ref]));
  const refTotal = refMode === "dollars" ? c.typicalTotal : c.youTotal;
  const plan = d.plans.find((p) => p.id === planId) ?? d.plans[0];
  const scaleMax = Math.max(0.6, ...(plan?.buckets.map((b) => Math.max(b.share ?? 0, b.max ?? 0)) ?? [0]));

  return (
    <div id="compare" className="scroll-mt-24 space-y-4">
      <Section
        title={`You vs ${ref.short}`}
        explain={
          <>
            <p>
              &quot;Typical&quot; is a {ref.label.toLowerCase()} built from the {ref.source} ({ref.year}): income before taxes about {fmtMoney(ref.incomeBeforeTax * 100, { whole: true })} a year, spending about {fmtMoney(c.typicalTotal, { whole: true })} a month.
            </p>
            <p>{ref.method}</p>
            <p>&quot;You&quot; is your {c.basis === "avg3" ? `average over the last ${c.fullMonthCount} full month${c.fullMonthCount === 1 ? "" : "s"}` : "spending this month"} per category, business excluded. Categories that share one survey line (Gifts & Giving and Tithe) are compared together.</p>
            <p>
              <strong className="font-semibold text-ink">In dollars</strong> compares raw amounts. <strong className="font-semibold text-ink">Scaled to your total</strong> asks a fairer question: if that household spent exactly what you spend in a month, how would it split the money? That shows where your mix differs from theirs even when incomes don&apos;t match.
            </p>
            <p>Change the household size and the reference area in Settings.</p>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">Typical</span> = a {ref.label}: {fmtMoney(ref.incomeBeforeTax * 100, { whole: true, compact: true })} before tax, {fmtMoney(c.typicalTotal, { whole: true })} spent a month{ref.modeled ? " (modeled from the survey)" : ""}.{" "}
          <span className="font-semibold text-ink">You</span> = your {c.basis === "avg3" ? `average over the last ${c.fullMonthCount} full month${c.fullMonthCount === 1 ? "" : "s"}` : "spending this month"}.
        </p>
        <div className="mt-3">
          <Segmented ariaLabel="Comparison mode" value={refMode} onChange={setRefMode} options={[{ id: "dollars", label: "In dollars" }, { id: "scaled", label: "Scaled to your total" }]} />
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {refMode === "dollars"
            ? `Raw amounts. That household spends ${fmtMoney(c.typicalTotal, { whole: true })} a month against your ${fmtMoney(c.youTotal, { whole: true })}, so rows will sit ${c.typicalTotal > c.youTotal ? "above" : "below"} yours overall.`
            : `How that household would split your ${fmtMoney(c.youTotal, { whole: true })} a month. Differences here are about the mix, not the amount.`}
        </p>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Log a few expenses to compare.</p>
        ) : (
          <>
            <ul className="mt-3 space-y-3">
              {shown.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => onDetail(r.id)} className="w-full text-left">
                    <div className="flex items-center gap-2 text-[14px]">
                      <Icon name={r.icon} size={16} className="shrink-0 text-ink-3" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {r.name}
                        {r.estimated && <span className="text-ink-3"> ~</span>}
                      </span>
                      <DiffLabel you={r.you} ref={r.ref} />
                    </div>
                    <div className="mt-1 space-y-1">
                      <BarLine label="You" value={r.you} max={max} color="var(--green)" />
                      <BarLine label="Typical" value={r.ref} max={max} color="var(--ink-3)" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {rows.length > 8 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 flex items-center gap-1 text-sm font-medium text-green-text">
                <ChevronDown size={16} className={showAll ? "rotate-180" : ""} /> {showAll ? "Show fewer" : `Show all ${rows.length}`}
              </button>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-line-strong pt-3 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">All spending</span>
              <span className="num">
                You <span className="font-semibold text-ink">{fmtMoney(c.youTotal, { whole: true })}</span>
                <span className="text-ink-3"> · </span>
                Typical <span className="font-semibold text-ink">{fmtMoney(refTotal, { whole: true })}</span>
              </span>
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-ink-3">
          {ref.source}, {ref.year}.{" "}
          <Link href="/settings" className="font-medium text-green-text underline-offset-2 hover:underline">
            Household size & area
          </Link>
        </p>
      </Section>

      <Section
        title="Rules of thumb"
        explain={
          <>
            <p>Five guidelines planners quote most, measured on your full months in this window. They are starting points, not verdicts: a big family in an expensive area will miss one or two on purpose.</p>
            <p>Shares use your logged take-home income. Published rules often use gross income, which makes them a little stricter here.</p>
          </>
        }
      >
        <ul className="divide-y divide-line">
          {d.rules.map((r) => {
            const value = r.value === null ? "—" : r.unit === "pct" ? fmtPct(r.value) : `${r.value >= 10 ? Math.round(r.value) : r.value.toFixed(1)} mo`;
            const open = openRule === r.id;
            return (
              <li key={r.id}>
                <button type="button" onClick={() => setOpenRule(open ? null : r.id)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm" aria-expanded={open}>
                  <StatusDot status={r.status} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.label}</span>
                    <span className="block text-xs text-ink-3">{r.guide}</span>
                  </span>
                  <span className={`num font-semibold ${r.status === "good" ? "text-green-text" : r.status === "watch" ? "text-warn" : r.status === "bad" ? "text-over" : "text-ink-3"}`}>{value}</span>
                  <ChevronDown size={16} className={`shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && <p className="pb-3 pl-6 text-sm text-ink-2">{r.why}</p>}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-3">{d.planMonths} full month{d.planMonths === 1 ? "" : "s"} · income {fmtMoney(d.planIncome, { whole: true })}</p>
      </Section>

      {plan && (
        <Section
          title="Compare with a famous plan"
          explain={
            <>
              <p>Three well-known ways to split take-home pay. Each bucket shows the share of your income over this window against the plan&apos;s recommended range (the gray band). Business spending is left out of every plan.</p>
              <p>
                <strong className="font-semibold text-ink">{plan.name}</strong> · {plan.author}. {plan.source}
              </p>
              <p>Giving and saving buckets flag being under the mark; spending buckets flag being over it. The small text under each bucket lists which of your categories landed in it.</p>
            </>
          }
        >
          <Segmented ariaLabel="Plan" value={planId} onChange={setPlanId} options={d.plans.map((p) => ({ id: p.id, label: p.id === "ramsey" ? "Ramsey" : p.id === "sethi" ? "Ramit Sethi" : "50/30/20" }))} />
          <p className="mt-3 text-sm text-ink-2">
            <span className="font-semibold text-ink">{plan.name}</span> · {plan.author}. {plan.tagline}
          </p>
          <ul className="mt-3 space-y-3">
            {plan.buckets.map((b) => {
              const share = b.share ?? 0;
              const lo = b.min ?? 0;
              const hi = b.max ?? (b.min !== null ? scaleMax : 0);
              const noTarget = b.min === null && b.max === null;
              const tone = b.status === "over" || b.status === "under" ? "var(--over)" : b.status === "in" ? "var(--save)" : "var(--ink-3)";
              return (
                <li key={b.id}>
                  <div className="flex items-center gap-2 text-[14px]">
                    <StatusDot status={b.status} />
                    <span className="min-w-0 flex-1 truncate font-medium">{b.label}</span>
                    <span className="num text-xs text-ink-3">{noTarget ? "no target" : b.min !== null && b.max !== null && b.min !== b.max ? `${fmtPct(b.min)}–${fmtPct(b.max)}` : b.max !== null && b.min === null ? `≤ ${fmtPct(b.max)}` : b.min !== null && b.max === null ? `≥ ${fmtPct(b.min)}` : fmtPct(b.max ?? 0)}</span>
                    <span className={`num w-14 text-right text-sm font-semibold ${b.status === "over" || b.status === "under" ? "text-over" : b.status === "in" ? "text-green-text" : "text-ink"}`}>{b.share === null ? "—" : fmtPct(b.share)}</span>
                  </div>
                  <div className="relative mt-1.5 h-2.5 w-full rounded-full bg-card-2">
                    {!noTarget && <div className="absolute inset-y-0 rounded-full bg-line-strong" style={{ left: `${(lo / scaleMax) * 100}%`, width: `${Math.max(1.5, ((hi - lo) / scaleMax) * 100)}%` }} aria-hidden />}
                    {b.share !== null && b.share > 0 && <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (share / scaleMax) * 100)}%`, backgroundColor: tone, opacity: 0.85 }} />}
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-3">
                    {fmtMoney(Math.round(b.amount / Math.max(1, d.planMonths)), { whole: true })}/mo{b.categories.length ? ` · ${b.categories.join(", ")}` : b.id === "savings" || b.id === "saving" || b.id === "fixed" || b.id === "giving" || b.id === "needs" ? "" : " · nothing here yet"}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-3">Shares of your logged take-home income over {d.planMonths} full month{d.planMonths === 1 ? "" : "s"}. Gray band = the plan&apos;s range.</p>
        </Section>
      )}
    </div>
  );
}
