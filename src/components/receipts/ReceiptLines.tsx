"use client";

import { Icon } from "@/components/ui/Icon";
import { fmtMoney } from "@/lib/money";
import { useAddSheet } from "@/components/shell/AppShell";
import type { ItemLite } from "@/lib/items";

export interface ReceiptLine {
  id: string;
  type: "expense" | "income" | "goal";
  amountCents: number;
  date: string;
  categoryId: string | null;
  subcategoryId: string | null;
  goalId: string | null;
  note: string;
  userId: string;
  categoryName: string;
  icon: string;
  subName: string | null;
  items: (ItemLite & { detail: string })[];
}

/** The lines of one receipt with their items; tapping a line opens it for editing. */
export function ReceiptLines({ lines, receiptId }: { lines: ReceiptLine[]; receiptId: string }) {
  const { openEdit } = useAddSheet();
  return (
    <ul className="space-y-3">
      {lines.map((l) => (
        <li key={l.id} className="rounded-card bg-card shadow-card">
          <button
            type="button"
            onClick={() =>
              openEdit({
                id: l.id,
                type: l.type,
                amountCents: l.amountCents,
                date: l.date,
                categoryId: l.categoryId,
                subcategoryId: l.subcategoryId,
                goalId: l.goalId,
                note: l.note,
                userId: l.userId,
                receiptId,
                items: l.items,
              })
            }
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card-2/60"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-2 text-ink-2">
              <Icon name={l.icon} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">
                {l.categoryName}
                {l.subName && <span className="font-normal text-ink-2"> · {l.subName}</span>}
              </span>
              <span className="block text-xs text-ink-3">{l.items.length ? `${l.items.length} item${l.items.length === 1 ? "" : "s"}` : "no item detail"}</span>
            </span>
            <span className="num text-[15px] font-semibold">{fmtMoney(l.amountCents)}</span>
          </button>
          {l.items.length > 0 && (
            <ul className="divide-y divide-line border-t border-line px-4 text-sm">
              {l.items.map((it) => (
                <li key={it.id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{it.name}</span>
                    {it.detail && <span className="block text-xs text-ink-3">{it.detail}</span>}
                  </span>
                  <span className="num text-ink-2">{fmtMoney(it.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
