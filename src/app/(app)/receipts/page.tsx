import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { loadHousehold } from "@/lib/queries";
import { dateLabel } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { Empty, MemberDot } from "@/components/ui/Bits";

export const metadata = { title: "Receipts" };

export default async function ReceiptsPage() {
  const viewer = await requireViewer();
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const itemCount = new Map<string, number>();
  for (const it of data.receiptItems) itemCount.set(it.transactionId, (itemCount.get(it.transactionId) ?? 0) + 1);
  const receipts = data.receipts
    .map((r) => {
      const lines = data.txs.filter((t) => t.receiptId === r.id);
      return {
        ...r,
        lines: lines.length,
        items: lines.reduce((a, t) => a + (itemCount.get(t.id) ?? 0), 0),
        total: lines.reduce((a, t) => a + t.amountCents, 0),
        member: data.members.find((m) => m.id === r.userId),
      };
    })
    .filter((r) => r.lines > 0);

  const byMonth = new Map<string, typeof receipts>();
  for (const r of receipts) (byMonth.get(r.date.slice(0, 7)) ?? byMonth.set(r.date.slice(0, 7), []).get(r.date.slice(0, 7)))!.push(r);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-1">
          <Link href="/activity" aria-label="Back" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-card-2">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="display text-2xl font-semibold tracking-tight">Receipts</h1>
        </div>
        <Link href="/import" className="flex items-center gap-1.5 rounded-xl bg-green px-3 py-2 text-sm font-medium text-green-ink">
          <Plus size={16} /> Import
        </Link>
      </div>

      {receipts.length === 0 ? (
        <Empty title="No receipts yet" body="Import one and every item on it (what, how much, price per pound) is kept here." />
      ) : (
        [...byMonth.entries()].map(([month, list]) => (
          <section key={month}>
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-3">
              {new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <ul className="divide-y divide-line rounded-card bg-card shadow-card">
              {list.map((r) => (
                <li key={r.id}>
                  <Link href={`/receipts/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-card-2/60">
                    {r.member && <MemberDot color={r.member.color} name={r.member.name} size="md" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{r.store || "Receipt"}</span>
                      <span className="block text-xs text-ink-3">
                        {dateLabel(r.date, viewer.today)} · {r.lines} line{r.lines === 1 ? "" : "s"}
                        {r.items > 0 && `, ${r.items} item${r.items === 1 ? "" : "s"}`}
                      </span>
                    </span>
                    <span className="num text-[15px] font-semibold">{fmtMoney(r.total)}</span>
                    <ChevronRight size={18} className="text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
