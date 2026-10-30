"use client";

import type { Category, Goal, Transaction } from "@/db/schema";
import { dateLabel } from "@/lib/dates";
import { Icon } from "@/components/ui/Icon";
import { MemberDot, Money } from "@/components/ui/Bits";
import { useAddSheet } from "@/components/shell/AppShell";

export function TxRow({
  tx,
  members,
  categories,
  subcategories = [],
  goals,
  today,
  showDate = false,
}: {
  tx: Transaction;
  members: { id: string; name: string; color: string }[];
  categories: Pick<Category, "id" | "name" | "icon">[];
  subcategories?: { id: string; name: string }[];
  goals: Pick<Goal, "id" | "name" | "icon">[];
  today: string;
  showDate?: boolean;
}) {
  const { openEdit } = useAddSheet();
  const member = members.find((m) => m.id === tx.userId);
  const cat = tx.categoryId ? categories.find((c) => c.id === tx.categoryId) : undefined;
  const sub = tx.subcategoryId ? subcategories.find((s) => s.id === tx.subcategoryId) : undefined;
  const goal = tx.goalId ? goals.find((g) => g.id === tx.goalId) : undefined;
  const title = tx.type === "goal" ? goal?.name ?? "Goal" : cat?.name ?? "Uncategorized";
  const icon = tx.type === "goal" ? goal?.icon ?? "PiggyBank" : cat?.icon ?? "Tag";
  const amountCls =
    tx.type === "income" ? "text-green-text" : tx.type === "goal" ? (tx.amountCents < 0 ? "text-over" : "text-save") : "text-ink";
  const meta = [showDate ? dateLabel(tx.date, today) : null, tx.note || null].filter(Boolean).join(" · ");

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
        <Money cents={tx.type === "income" ? tx.amountCents : tx.type === "goal" ? tx.amountCents : -tx.amountCents} signed className={`text-[15px] font-semibold ${amountCls}`} />
      </button>
    </li>
  );
}
