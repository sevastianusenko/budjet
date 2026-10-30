import { requireViewer } from "@/lib/auth";
import { loadHousehold, resolveMonth, type SearchParams } from "@/lib/queries";
import { monthOf } from "@/lib/dates";
import { MonthSwitcher } from "@/components/shell/MonthSwitcher";
import { ActivityList } from "@/components/activity/ActivityList";

export const metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const month = resolveMonth(sp.m, viewer.today);
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const txs = data.txs.filter((t) => t.date.startsWith(month));

  return (
    <div className="space-y-4">
      <h1 className="display pt-2 text-2xl font-semibold tracking-tight">Activity</h1>
      <MonthSwitcher month={month} currentMonth={monthOf(viewer.today)} />
      <ActivityList
        txs={txs}
        members={data.members.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
        categories={data.categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))}
        subcategories={data.subcategories.map((s) => ({ id: s.id, name: s.name }))}
        goals={data.goals.map((g) => ({ id: g.id, name: g.name, icon: g.icon }))}
        today={viewer.today}
      />
    </div>
  );
}
