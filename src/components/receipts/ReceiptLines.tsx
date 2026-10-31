"use client";

import { useMemo, useState } from "react";
import { ReceiptCategoryGroup, type GroupLine } from "./ReceiptCategoryGroup";

export interface ReceiptLine extends GroupLine {
  categoryName: string;
  icon: string;
}

/** The lines of one receipt, one row per main category; tap a row to see its subcategories and items. */
export function ReceiptLines({ lines, receiptId, store, today }: { lines: ReceiptLine[]; receiptId: string; store?: string; today: string }) {
  const [all, setAll] = useState(false);
  const groups = useMemo(() => {
    const map = new Map<string, ReceiptLine[]>();
    for (const l of lines) map.set(l.categoryId ?? "", [...(map.get(l.categoryId ?? "") ?? []), l]);
    return [...map.values()];
  }, [lines]);
  const hasItems = lines.some((l) => l.items.length > 0);

  return (
    <div className="space-y-2">
      {hasItems && groups.length > 0 && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setAll((a) => !a)} className="rounded-lg px-2 py-1 text-sm font-medium text-green-text hover:bg-card-2">
            {all ? "Hide all items" : "Show all items"}
          </button>
        </div>
      )}
      <ul className="divide-y divide-line rounded-card bg-card shadow-card">
        {groups.map((g) => (
          <ReceiptCategoryGroup
            key={`${g[0].categoryId}-${all}`}
            receiptId={receiptId}
            categoryName={g[0].categoryName}
            icon={g[0].icon}
            lines={g}
            store={store}
            today={today}
            defaultOpen={all}
          />
        ))}
      </ul>
    </div>
  );
}
