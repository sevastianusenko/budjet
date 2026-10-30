"use client";

import Link from "next/link";
import { useState } from "react";
import type { CategoryDetail } from "@/lib/details";
import { fmtMoney } from "@/lib/money";
import { Icon } from "@/components/ui/Icon";
import { Bar, Pill, SectionTitle } from "@/components/ui/Bits";
import { CategoryDetailSheet } from "@/components/plan/CategoryDetailSheet";

/** The categories that need attention this month: over, running fast, or the biggest. Tap one for the breakdown. */
export function CategoryPulse({
  details,
  month,
  marker,
  today,
}: {
  details: CategoryDetail[];
  month: string;
  /** 0..1 position of today in the month, or null for past/future months */
  marker: number | null;
  today: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = details.filter((r) => r.available > 0 || r.spent > 0);
  if (rows.length === 0) return null;
  const score = (r: CategoryDetail) => (r.pace === "over" ? 3 : r.pace === "ahead" ? 2 : 0) * 1e9 + r.spent;
  const top = [...rows].sort((a, b) => score(b) - score(a)).slice(0, 5);

  return (
    <section>
      <SectionTitle
        action={
          <Link href={`/plan?m=${month}`} className="text-[13px] font-medium text-green-text">
            Full plan
          </Link>
        }
      >
        Categories
      </SectionTitle>
      <ul className="divide-y divide-line rounded-card bg-card shadow-card">
        {top.map((r) => {
          const tone = r.pace === "over" ? "over" : r.pace === "ahead" ? "warn" : "green";
          return (
            <li key={r.id}>
              <button type="button" onClick={() => setOpenId(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card-2/60">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-2 text-ink-2">
                  <Icon name={r.icon} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-medium">{r.name}</span>
                    <span className="num shrink-0 text-sm text-ink-2">
                      <span className="font-semibold text-ink">{fmtMoney(r.spent, { whole: true })}</span>
                      {r.available > 0 && <span className="text-ink-3"> / {fmtMoney(r.available, { whole: true })}</span>}
                    </span>
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <Bar value={r.spent} max={r.available} tone={tone} marker={!r.isFixed ? marker : null} className="flex-1" />
                    {r.pace === "over" && <Pill tone="over">over {fmtMoney(-r.remaining, { whole: true })}</Pill>}
                    {r.pace === "ahead" && <Pill tone="warn">fast</Pill>}
                    {r.carry > 0 && <Pill tone="green">+{fmtMoney(r.carry, { whole: true })} carried</Pill>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <CategoryDetailSheet detail={details.find((d) => d.id === openId) ?? null} onClose={() => setOpenId(null)} today={today} />
    </section>
  );
}
