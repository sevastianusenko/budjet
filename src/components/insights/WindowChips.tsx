"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { WindowKey } from "@/lib/trends";

const OPTIONS: { id: WindowKey; label: string }[] = [
  { id: "3", label: "3 mo" },
  { id: "6", label: "6 mo" },
  { id: "12", label: "12 mo" },
  { id: "all", label: "All" },
];

/** How many months the trend blocks look back. Kept in the URL (?w=) so the month switcher preserves it. */
export function WindowChips({ value }: { value: WindowKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  function set(w: WindowKey) {
    const params = new URLSearchParams(sp.toString());
    if (w === "6") params.delete("w");
    else params.set("w", w);
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-ink-3">Trends look back</span>
      <div role="tablist" aria-label="Trend window" className="flex rounded-xl bg-card-2 p-1 text-[12px] font-medium">
        {OPTIONS.map((o) => (
          <button key={o.id} role="tab" type="button" aria-selected={value === o.id} onClick={() => set(o.id)} className={`h-7 rounded-lg px-2.5 ${value === o.id ? "bg-card text-ink shadow-sm" : "text-ink-2"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
