import { requireViewer } from "@/lib/auth";
import { loadHousehold, resolveMonth, type SearchParams } from "@/lib/queries";
import { monthOf } from "@/lib/dates";
import { MonthSwitcher } from "@/components/shell/MonthSwitcher";
import { ActivityList } from "@/components/activity/ActivityList";
import { groupItems } from "@/lib/items";
import { UncategorizedBanner } from "@/components/home/UncategorizedBanner";
import Link from "next/link";
import { ReceiptText } from "lucide-react";

export const metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const month = resolveMonth(sp.m, viewer.today);
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const txs = data.txs.filter((t) => t.date.startsWith(month));
  const uncId = data.categories.find((c) => c.name === "Uncategorized" && c.kind === "expense")?.id;
  const unc = data.txs.filter((t) => t.type === "expense" && t.categoryId === uncId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="display text-2xl font-semibold tracking-tight">Activity</h1>
        <Link href="/receipts" className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-green-text hover:bg-card-2">
          <ReceiptText size={16} /> Receipts
        </Link>
      </div>
      <MonthSwitcher month={month} currentMonth={monthOf(viewer.today)} />
      <UncategorizedBanner count={unc.length} totalCents={unc.reduce((a, t) => a + t.amountCents, 0)} />
      <ActivityList
        txs={txs}
        members={data.members.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
        categories={data.categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))}
        subcategories={data.subcategories.map((s) => ({ id: s.id, name: s.name }))}
        goals={data.goals.map((g) => ({ id: g.id, name: g.name, icon: g.icon, isTithe: g.isTithe }))}
        itemsByTx={groupItems(data.receiptItems)}
        today={viewer.today}
      />
    </div>
  );
}
