import Link from "next/link";
import type { Category, Recurring, Transaction } from "@/db/schema";
import { dateInMonth, shortDate, type ISODate, type Month } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { Icon } from "@/components/ui/Icon";
import { Pill, SectionTitle } from "@/components/ui/Bits";
import { MarkPaidButton } from "@/components/bills/MarkPaidButton";

export interface BillStatus {
  bill: Recurring;
  due: ISODate;
  paid: boolean;
  paidTx?: Transaction;
  daysUntil: number;
}

export function billStatuses(bills: Recurring[], txs: Transaction[], month: Month, today: ISODate): BillStatus[] {
  const dayMs = 86_400_000;
  const toMs = (d: ISODate) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return bills
    .filter((b) => b.active)
    .map((bill) => {
      const due = dateInMonth(month, bill.dayOfMonth);
      const paidTx = txs.find((t) => t.recurringId === bill.id && t.date.startsWith(month));
      return { bill, due, paid: Boolean(paidTx), paidTx, daysUntil: Math.round((toMs(due) - toMs(today)) / dayMs) };
    })
    .sort((a, b) => Number(a.paid) - Number(b.paid) || a.due.localeCompare(b.due));
}

export function UpcomingBills({
  bills,
  txs,
  month,
  today,
  categories,
  limit = 4,
}: {
  bills: Recurring[];
  txs: Transaction[];
  month: Month;
  today: ISODate;
  categories: Category[];
  limit?: number;
}) {
  const statuses = billStatuses(bills, txs, month, today);
  if (statuses.length === 0) return null;
  const unpaid = statuses.filter((s) => !s.paid);
  const shown = statuses.slice(0, limit);
  const catIcon = (id: string) => categories.find((c) => c.id === id)?.icon ?? "Tag";
  const totalDue = unpaid.reduce((a, s) => a + s.bill.amountCents, 0);

  return (
    <section>
      <SectionTitle
        action={
          <Link href="/settings/bills" className="text-[13px] font-medium text-green-text">
            All bills
          </Link>
        }
      >
        Bills{unpaid.length > 0 && <span className="ml-2 normal-case tracking-normal text-ink-3">· {fmtMoney(totalDue, { whole: true })} still due</span>}
      </SectionTitle>
      <ul className="divide-y divide-line rounded-card bg-card shadow-card">
        {shown.map((s) => (
          <li key={s.bill.id} className="flex items-center gap-3 px-4 py-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.paid ? "bg-green-soft text-green-text" : "bg-card-2 text-ink-2"}`}>
              <Icon name={catIcon(s.bill.categoryId)} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{s.bill.name}</p>
              <p className="text-xs text-ink-3">
                {s.paid ? (
                  <>Paid {s.paidTx ? shortDate(s.paidTx.date) : ""}</>
                ) : s.daysUntil < 0 ? (
                  <span className="text-over">Due {shortDate(s.due)} · {-s.daysUntil}d overdue</span>
                ) : s.daysUntil === 0 ? (
                  "Due today"
                ) : (
                  <>Due {shortDate(s.due)} · in {s.daysUntil}d</>
                )}
              </p>
            </div>
            <span className="num text-[15px] font-semibold">{fmtMoney(s.bill.amountCents)}</span>
            {s.paid ? <Pill tone="green">Paid</Pill> : <MarkPaidButton billId={s.bill.id} month={month} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
