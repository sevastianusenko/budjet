/**
 * Groups the entries of one receipt by main category, so ten vegetables, meat and milk
 * read as one "Groceries" row while a different category stays its own row. Subcategories
 * and items stay inside the group; nothing is merged in the database.
 */
export interface GroupableTx {
  id: string;
  type: "expense" | "income" | "goal";
  receiptId: string | null;
  categoryId: string | null;
}

export type FeedRow<T extends GroupableTx> =
  | { kind: "tx"; tx: T }
  | { kind: "receipt"; key: string; receiptId: string; categoryId: string | null; txs: T[] };

/** Keeps the original order; a group sits where its first entry was. */
export function groupReceiptLines<T extends GroupableTx>(txs: T[]): FeedRow<T>[] {
  const rows: FeedRow<T>[] = [];
  const byKey = new Map<string, Extract<FeedRow<T>, { kind: "receipt" }>>();
  for (const tx of txs) {
    if (tx.type !== "expense" || !tx.receiptId) {
      rows.push({ kind: "tx", tx });
      continue;
    }
    const key = `${tx.receiptId}:${tx.categoryId ?? ""}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.txs.push(tx);
      continue;
    }
    const row = { kind: "receipt" as const, key, receiptId: tx.receiptId, categoryId: tx.categoryId, txs: [tx] };
    byKey.set(key, row);
    rows.push(row);
  }
  return rows;
}
