import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { loadHousehold, resolveMonth, type SearchParams } from "@/lib/queries";
import { monthOf } from "@/lib/dates";
import { billStatuses } from "@/components/home/UpcomingBills";
import { BillsManager } from "@/components/settings/BillsManager";
import { MonthSwitcher } from "@/components/shell/MonthSwitcher";

export const metadata = { title: "Recurring bills" };

export default async function BillsPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const month = resolveMonth(sp.m, viewer.today);
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const statuses = billStatuses(data.recurring, data.txs, month, viewer.today);
  const inactive = data.recurring.filter((r) => !r.active);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 pt-2">
        <Link href="/settings" aria-label="Back to settings" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-card-2">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="display text-2xl font-semibold tracking-tight">Recurring bills</h1>
      </div>
      <MonthSwitcher month={month} currentMonth={monthOf(viewer.today)} />
      <BillsManager
        month={month}
        items={statuses.map((s) => ({
          bill: { id: s.bill.id, name: s.bill.name, amountCents: s.bill.amountCents, dayOfMonth: s.bill.dayOfMonth, categoryId: s.bill.categoryId, type: s.bill.type, active: s.bill.active },
          due: s.due,
          paid: s.paid,
          paidDate: s.paidTx?.date ?? null,
          daysUntil: s.daysUntil,
        }))}
        inactive={inactive.map((b) => ({ id: b.id, name: b.name, amountCents: b.amountCents, dayOfMonth: b.dayOfMonth, categoryId: b.categoryId, type: b.type, active: b.active }))}
        categories={data.categories.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name, icon: c.icon, kind: c.kind }))}
      />
    </div>
  );
}
