"use client";

import { Church, HandHeart } from "lucide-react";
import type { TitheStats } from "@/lib/tithe-stats";
import { fmtMoney } from "@/lib/money";
import { Explain } from "@/components/ui/Explain";
import { Button } from "@/components/ui/Button";
import { useAddSheet } from "@/components/shell/AppShell";

/** The Tithe fund: what's been set aside, what's been given, what's left to give. */
export function TitheFundCard({
  stats,
  tithePct,
  churchDefaults,
  helpDefaults,
  compact = false,
}: {
  stats: TitheStats;
  tithePct: number;
  /** Category / subcategory to pre-select for "Gave to church". */
  churchDefaults: { categoryId?: string; subcategoryId?: string };
  helpDefaults: { categoryId?: string; subcategoryId?: string };
  compact?: boolean;
}) {
  const { openNew } = useAddSheet();
  const low = stats.balance <= 0;

  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Tithe fund</h2>
        <Explain title="The Tithe fund">
          <p>Every income you log sets aside {tithePct}% into this fund automatically (it shows under Needs the moment the money comes in).</p>
          <p>When you give to church or help someone, log it as an expense and leave &quot;Paid from the Tithe fund&quot; on: the balance goes down and it is not counted as new spending. Switch it off for extra giving from your own money.</p>
          <p>Balance = starting amount + set-asides − giving from the fund. Giving cash still counts: log it the same way.</p>
        </Explain>
      </div>
      <p className={`display mt-1 text-3xl font-semibold tracking-tight ${low ? "text-over" : "text-ink"}`}>{fmtMoney(stats.balance, { whole: true })}</p>
      <p className="mt-1 text-sm text-ink-2">
        {low ? "Nothing left in the fund." : "left to give."} This month: <span className="num font-medium text-ink">+{fmtMoney(stats.setAsideMonth, { whole: true })}</span> set aside,{" "}
        <span className="num font-medium text-ink">−{fmtMoney(stats.givenMonth, { whole: true })}</span> given
        {stats.givenYear > 0 && (
          <>
            {" "}· <span className="num">{fmtMoney(stats.givenYear, { whole: true })}</span> given this year
          </>
        )}
      </p>
      {!compact && stats.byLabelMonth.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {stats.byLabelMonth.map((r) => (
            <li key={r.label} className="flex items-center justify-between">
              <span className="text-ink-2">{r.label}</span>
              <span className="num font-medium">{fmtMoney(r.cents, { whole: true })}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => openNew({ type: "expense", fromFund: true, ...churchDefaults })}>
          <Church size={16} /> Gave to church
        </Button>
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => openNew({ type: "expense", fromFund: true, ...helpDefaults })}>
          <HandHeart size={16} /> Helped someone
        </Button>
      </div>
    </section>
  );
}
