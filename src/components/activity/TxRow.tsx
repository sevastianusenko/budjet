"use client";

import type { Category, Transaction } from "@/db/schema";
import { dateLabel } from "@/lib/dates";
import { Icon } from "@/components/ui/Icon";
import { MemberDot, Money } from "@/components/ui/Bits";
import { useAddSheet } from "@/components/shell/AppShell";
import type { ItemLite } from "@/lib/items";

export interface RowGoal {
  id: string;
  name: string;
  icon: string;
  isTithe?: boolean;
}

export function TxRow({
  tx,
  members,
  categories,
  subcategories = [],
  goals,
  items = [],
  today,
  showDate = false,
}: {
  tx: Transaction;
  members: { id: string; name: string; color: string }[];
  categories: Pick<Category, "id" | "name" | "icon">[];
  subcategories?: { id: string; name: string }[];
  goals: RowGoal[];
  items?: ItemLite[];
  today: string;
  showDate?: boolean;
}) {
  const { openEdit } = useAddSheet();
  const member = members.find((m) => m.id === tx.userId);
  const cat = tx.categoryId ? categories.find((c) => c.id === tx.categoryId) : undefined;
  const sub = tx.subcategoryId ? subcategories.find((s) => s.id === tx.subcategoryId) : undefined;
  const goal = tx.goalId ? goals.find((g) => g.id === tx.goalId) : undefined;
  const fundGiving = tx.type === "goal" && goal?.isTithe && tx.amountCents < 0;
  const setAside = tx.type === "goal" && goal?.isTithe && tx.amountCents > 0;

  const title = fundGiving ? cat?.name ?? "Giving" : tx.type === "goal" ? goal?.name ?? "Goal" : cat?.name ?? "Uncategorized";
  const icon = fundGiving ? cat?.icon ?? "Church" : tx.type === "goal" ? goal?.icon ?? "PiggyBank" : cat?.icon ?? "Tag";
  const amountCls =
    tx.type === "income"
      ? "text-green-text"
      : fundGiving
        ? "text-ink-2"
        : tx.type === "goal"
          ? tx.amountCents < 0
            ? "text-over"
            : setAside
              ? "text-ink-2"
              : "text-save"
          : "text-ink";
  const meta = [
    showDate ? dateLabel(tx.date, today) : null,
    fundGiving ? "from Tithe fund" : setAside ? "set aside" : null,
    items.length > 0 ? `${items.length} item${items.length === 1 ? "" : "s"}` : null,
    tx.note || null,
  ]
    .filter(Boolean)
    .join(" · ");
  const shown = tx.type === "income" ? tx.amountCents : tx.type === "goal" ? tx.amountCents : -tx.amountCents;

  return (
    <li>
      <button
        type="button"
        onClick={() =>
          openEdit({
            id: tx.id,
            type: tx.type,
            amountCents: tx.amountCents,
            date: tx.date,
            categoryId: tx.categoryId,
            subcategoryId: tx.subcategoryId,
            goalId: tx.goalId,
            note: tx.note,
            userId: tx.userId,
            receiptId: tx.receiptId,
            items,
          })
        }
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
          <span className="block truncate text-[15px] font-medium">
            {title}
            {sub && <span className="font-normal text-ink-2"> · {sub.name}</span>}
          </span>
          {meta && <span className="block truncate text-xs text-ink-3">{meta}</span>}
        </span>
        <Money cents={shown} signed className={`text-[15px] font-semibold ${amountCls}`} />
      </button>
    </li>
  );
}
