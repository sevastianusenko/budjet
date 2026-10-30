import Link from "next/link";
import { ArrowRight, CircleHelp } from "lucide-react";
import { fmtMoney } from "@/lib/money";

/** Shown while imported entries are still parked in Uncategorized. */
export function UncategorizedBanner({ count, totalCents }: { count: number; totalCents: number }) {
  if (count === 0) return null;
  return (
    <Link href="/sort" className="flex items-center gap-3 rounded-card border border-warn/40 bg-warn-soft px-4 py-3 text-sm shadow-card hover:brightness-[0.98]">
      <CircleHelp size={20} className="shrink-0 text-warn" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">
          {count} entr{count === 1 ? "y" : "ies"} without a category · {fmtMoney(totalCents, { whole: true })}
        </span>
        <span className="block text-xs text-ink-2">Sort them by merchant in a minute; they count as Wants until then.</span>
      </span>
      <ArrowRight size={18} className="shrink-0 text-ink-3" />
    </Link>
  );
}
