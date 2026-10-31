"use client";

import type { Transaction } from "@/db/schema";
import { groupReceiptLines } from "@/lib/receipt-group";
import type { ItemLite } from "@/lib/items";
import { ReceiptCategoryGroup } from "@/components/receipts/ReceiptCategoryGroup";
import { TxRow, type RowGoal } from "./TxRow";

/** Entries as list rows; lines of one receipt in the same main category collapse into one row. */
export function FeedRows({
  txs,
  members,
  categories,
  subcategories,
  goals,
  itemsByTx = {},
  today,
  showDate = false,
}: {
  txs: Transaction[];
  members: { id: string; name: string; color: string }[];
  categories: { id: string; name: string; icon: string }[];
  subcategories: { id: string; name: string }[];
  goals: RowGoal[];
  itemsByTx?: Record<string, ItemLite[]>;
  today: string;
  showDate?: boolean;
}) {
  return (
    <>
      {groupReceiptLines(txs).map((row) => {
        if (row.kind === "tx") {
          const t = row.tx;
          return <TxRow key={t.id} tx={t} members={members} categories={categories} subcategories={subcategories} goals={goals} items={itemsByTx[t.id]} today={today} showDate={showDate} />;
        }
        const cat = categories.find((c) => c.id === row.categoryId);
        return (
          <ReceiptCategoryGroup
            key={row.key}
            receiptId={row.receiptId}
            categoryName={cat?.name ?? "Uncategorized"}
            icon={cat?.icon ?? "Tag"}
            member={members.find((m) => m.id === row.txs[0].userId)}
            today={today}
            showDate={showDate}
            linkToReceipt
            lines={row.txs.map((t) => ({
              id: t.id,
              amountCents: t.amountCents,
              date: t.date,
              categoryId: t.categoryId,
              subcategoryId: t.subcategoryId,
              note: t.note,
              userId: t.userId,
              subName: subcategories.find((s) => s.id === t.subcategoryId)?.name ?? null,
              items: itemsByTx[t.id] ?? [],
            }))}
          />
        );
      })}
    </>
  );
}
