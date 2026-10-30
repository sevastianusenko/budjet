/** Item detail under an entry (what exactly was bought), serializable for client components. */
export interface ItemLite {
  id: string;
  name: string;
  qty: number | null;
  unit: string | null;
  unitPriceCents: number | null;
  amountCents: number;
}

export function groupItems<T extends ItemLite & { transactionId: string; sortOrder: number }>(items: T[]): Record<string, ItemLite[]> {
  const out: Record<string, ItemLite[]> = {};
  for (const it of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    (out[it.transactionId] ??= []).push({
      id: it.id,
      name: it.name,
      qty: it.qty,
      unit: it.unit,
      unitPriceCents: it.unitPriceCents,
      amountCents: it.amountCents,
    });
  }
  return out;
}
