import type { Transaction } from "@/db/schema";
import { categoryBreakdown, type BreakdownRow, type Group, type MonthSummary, type Pace, type SubLite, type TxLite } from "./calc";
import type { ItemLite } from "./items";

export interface EntryLite {
  id: string;
  date: string;
  amountCents: number;
  type: "expense" | "income" | "goal";
  categoryId: string | null;
  subcategoryId: string | null;
  subName: string | null;
  goalId: string | null;
  note: string;
  userId: string;
  memberName: string;
  memberColor: string;
  receiptId: string | null;
  items: ItemLite[];
}

/** Everything the category detail sheet needs, serializable for client components. */
export interface CategoryDetail {
  id: string;
  name: string;
  icon: string;
  group: Group;
  isFixed: boolean;
  month: string;
  planned: number;
  carry: number;
  available: number;
  spent: number;
  remaining: number;
  pace: Pace;
  avg3: number;
  breakdown: BreakdownRow[];
  entries: EntryLite[];
}

export function buildCategoryDetails(
  summary: MonthSummary,
  txs: Transaction[],
  txLite: TxLite[],
  subs: SubLite[],
  members: { id: string; name: string; color: string }[],
  itemsByTx: Record<string, ItemLite[]> = {},
): CategoryDetail[] {
  const memberById = new Map(members.map((m) => [m.id, m]));
  const subById = new Map(subs.map((s) => [s.id, s]));
  return summary.rows.map((r) => {
    const { rows } = categoryBreakdown(r.cat.id, summary.month, txLite, subs);
    const entries = txs
      .filter((t) => t.type === "expense" && t.categoryId === r.cat.id && t.date.startsWith(summary.month))
      .map((t) => {
        const m = memberById.get(t.userId);
        return {
          id: t.id,
          date: t.date,
          amountCents: t.amountCents,
          type: t.type,
          categoryId: t.categoryId,
          subcategoryId: t.subcategoryId,
          subName: t.subcategoryId ? subById.get(t.subcategoryId)?.name ?? null : null,
          goalId: t.goalId,
          note: t.note,
          userId: t.userId,
          memberName: m?.name ?? "",
          memberColor: m?.color ?? "#888",
          receiptId: t.receiptId,
          items: itemsByTx[t.id] ?? [],
        };
      });
    return {
      id: r.cat.id,
      name: r.cat.name,
      icon: r.cat.icon,
      group: r.cat.group,
      isFixed: r.cat.isFixed,
      month: summary.month,
      planned: r.planned,
      carry: r.carry,
      available: r.available,
      spent: r.spent,
      remaining: r.remaining,
      pace: r.pace,
      avg3: r.avg3,
      breakdown: rows,
      entries,
    };
  });
}
