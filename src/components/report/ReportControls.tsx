"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { periodHref, type Period, type PeriodKind } from "@/lib/period";

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
];

/** Period picker + print / download. Hidden when printing. */
export function ReportControls({ period, csvHref }: { period: Period; csvHref: string }) {
  const router = useRouter();
  return (
    <div className="no-print space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div role="tablist" className="flex rounded-xl bg-card-2 p-1">
          {KINDS.map((k) => (
            <button
              key={k.id}
              role="tab"
              aria-selected={period.kind === k.id}
              type="button"
              onClick={() => router.push(periodHref(k.id, k.id === "month" ? period.months[0] : k.id === "year" ? period.months[0].slice(0, 4) : `${period.months[0].slice(0, 4)}-Q${Math.floor((Number(period.months[0].slice(5, 7)) - 1) / 3) + 1}`))}
              className={`h-8 rounded-lg px-3 text-[13px] font-medium ${period.kind === k.id ? "bg-card text-ink shadow-sm" : "text-ink-2"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Link href={periodHref(period.kind, period.prevKey)} aria-label="Previous period" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-card-2">
            <ChevronLeft size={20} />
          </Link>
          <Link href={periodHref(period.kind, period.nextKey)} aria-label="Next period" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-card-2">
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => window.print()} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl bg-green text-[15px] font-medium text-green-ink">
          <Printer size={18} /> Print / Save as PDF
        </button>
        <a href={csvHref} className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-line-strong px-4 text-[15px] font-medium text-ink">
          <Download size={18} /> CSV
        </a>
      </div>
    </div>
  );
}
