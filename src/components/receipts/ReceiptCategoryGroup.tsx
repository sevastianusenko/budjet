"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { MemberDot, Money } from "@/components/ui/Bits";
import { fmtMoney } from "@/lib/money";
import { dateLabel } from "@/lib/dates";
import { describeItem } from "@/lib/receipt-parse";
import { useAddSheet } from "@/components/shell/AppShell";
import type { ItemLite } from "@/lib/items";

export interface GroupLine {
  id: string;
  amountCents: number;
  date: string;
  categoryId: string | null;
  subcategoryId: string | null;
  note: string;
  userId: string;
  subName: string | null;
  items: ItemLite[];
}

/**
 * One receipt, one main category: a single row with the total; tap it to see which
 * subcategories and which items (name, quantity, price per unit) are inside.
 */
export function ReceiptCategoryGroup({
  receiptId,
  categoryName,
  icon,
  lines,
  member,
  store,
  today,
  showDate = false,
  defaultOpen = false,
  linkToReceipt = false,
}: {
  receiptId: string;
  categoryName: string;
  icon: string;
  lines: GroupLine[];
  member?: { name: string; color: string };
  store?: string;
  today: string;
  showDate?: boolean;
  defaultOpen?: boolean;
  /** Show an "Open the whole receipt" link when expanded (the feed); the receipt page itself omits it. */
  linkToReceipt?: boolean;
}) {
  const { openEdit } = useAddSheet();
  const [open, setOpen] = useState(defaultOpen);
  const total = lines.reduce((a, l) => a + l.amountCents, 0);
  const itemCount = lines.reduce((a, l) => a + l.items.length, 0);
  const subNames = [...new Set(lines.map((l) => l.subName).filter((n): n is string => Boolean(n)))];
  const meta = [
    showDate ? dateLabel(lines[0].date, today) : null,
    store || null,
    subNames.length ? subNames.join(", ") : null,
    itemCount > 0 ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card-2/60"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-2 text-ink-2">
          <Icon name={icon} size={18} />
          {member && (
            <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-card">
              <MemberDot color={member.color} name={member.name} size="xs" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{categoryName}</span>
          {meta && <span className="block truncate text-xs text-ink-3">{meta}</span>}
        </span>
        <Money cents={-total} signed className="text-[15px] font-semibold text-ink" />
        <ChevronDown size={16} className={`shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-line bg-card-2/40 px-4 pb-2 pt-1">
          {lines.map((l) => (
            <div key={l.id} className="py-1.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-2">{l.subName ?? categoryName}</span>
                <span className="num text-[13px] font-semibold text-ink-2">{fmtMoney(l.amountCents)}</span>
                <button
                  type="button"
                  onClick={() =>
                    openEdit({
                      id: l.id,
                      type: "expense",
                      amountCents: l.amountCents,
                      date: l.date,
                      categoryId: l.categoryId,
                      subcategoryId: l.subcategoryId,
                      goalId: null,
                      note: l.note,
                      userId: l.userId,
                      receiptId,
                      items: l.items,
                    })
                  }
                  className="rounded-lg px-2 py-1 text-xs font-medium text-green-text hover:bg-card-2"
                >
                  Edit
                </button>
              </div>
              {l.items.length > 0 ? (
                <ul className="divide-y divide-line text-sm">
                  {l.items.map((it) => {
                    const detail = describeItem(it);
                    return (
                      <li key={it.id} className="flex items-center gap-2 py-1.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{it.name}</span>
                          {detail && <span className="block text-xs text-ink-3">{detail}</span>}
                        </span>
                        <span className="num text-ink-2">{fmtMoney(it.amountCents)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-1 text-xs text-ink-3">No item detail for this line.</p>
              )}
            </div>
          ))}
          {linkToReceipt && (
            <Link href={`/receipts/${receiptId}`} className="flex items-center gap-1 py-2 text-sm font-medium text-green-text">
              Open the whole receipt <ChevronRight size={14} />
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
