import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { loadHousehold } from "@/lib/queries";
import { groupItems } from "@/lib/items";
import { dateLabel } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { describeItem } from "@/lib/receipt-parse";
import { Icon } from "@/components/ui/Icon";
import { MemberDot } from "@/components/ui/Bits";
import { ReceiptLines } from "@/components/receipts/ReceiptLines";

export const metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const receipt = data.receipts.find((r) => r.id === id);
  if (!receipt) notFound();
  const itemsByTx = groupItems(data.receiptItems);
  const lines = data.txs
    .filter((t) => t.receiptId === receipt.id)
    .map((t) => {
      const cat = data.categories.find((c) => c.id === t.categoryId);
      const sub = data.subcategories.find((s) => s.id === t.subcategoryId);
      return {
        id: t.id,
        type: t.type,
        amountCents: t.amountCents,
        date: t.date,
        categoryId: t.categoryId,
        subcategoryId: t.subcategoryId,
        goalId: t.goalId,
        note: t.note,
        userId: t.userId,
        categoryName: cat?.name ?? "Uncategorized",
        icon: cat?.icon ?? "Tag",
        subName: sub?.name ?? null,
        items: (itemsByTx[t.id] ?? []).map((it) => ({ ...it, detail: describeItem(it) })),
      };
    });
  const total = lines.reduce((a, l) => a + l.amountCents, 0);
  const member = data.members.find((m) => m.id === receipt.userId);
  const itemCount = lines.reduce((a, l) => a + l.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 pt-2">
        <Link href="/receipts" aria-label="Back to receipts" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-card-2">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="display truncate text-2xl font-semibold tracking-tight">{receipt.store || "Receipt"}</h1>
      </div>

      <section className="rounded-card bg-card p-4 shadow-card">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{dateLabel(receipt.date, viewer.today)}</p>
        <p className="display mt-1 text-3xl font-semibold tracking-tight">{fmtMoney(total)}</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-2">
          {member && <MemberDot color={member.color} name={member.name} size="sm" />}
          {member?.name}
          <span className="text-ink-3">
            · {new Set(lines.map((l) => l.categoryId)).size} categor{new Set(lines.map((l) => l.categoryId)).size === 1 ? "y" : "ies"}
            {itemCount > 0 && `, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
          </span>
          {receipt.totalCents > 0 && Math.abs(receipt.totalCents - total) > 100 && <span className="text-warn">· receipt said {fmtMoney(receipt.totalCents)}</span>}
        </p>
      </section>

      <ReceiptLines lines={lines} receiptId={receipt.id} store={receipt.store} today={viewer.today} />
      <p className="px-1 text-xs text-ink-3">
        Tap a category to see what was bought. <Icon name="Tag" size={12} className="inline" /> Items are kept as the receipt showed them.
      </p>
    </div>
  );
}
