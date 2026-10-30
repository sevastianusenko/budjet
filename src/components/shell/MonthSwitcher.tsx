"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, monthLabel, type Month } from "@/lib/dates";

export function MonthSwitcher({ month, currentMonth }: { month: Month; currentMonth: Month }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function go(m: Month) {
    const params = new URLSearchParams(sp.toString());
    if (m === currentMonth) params.delete("m");
    else params.set("m", m);
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  const isCurrent = month === currentMonth;
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => go(addMonths(month, -1))}
        aria-label="Previous month"
        className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-card-2"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        onClick={() => !isCurrent && go(currentMonth)}
        className="display text-lg font-semibold tracking-tight"
        title={isCurrent ? undefined : "Back to this month"}
      >
        {monthLabel(month)}
        {!isCurrent && <span className="ml-2 align-middle text-xs font-medium text-ink-3">· today</span>}
      </button>
      <button
        type="button"
        onClick={() => go(addMonths(month, 1))}
        aria-label="Next month"
        className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-card-2"
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
}
