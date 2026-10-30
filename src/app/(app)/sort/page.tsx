import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { loadHousehold } from "@/lib/queries";
import { ensureUncategorized } from "@/lib/uncategorized";
import { SortScreen } from "@/components/sort/SortScreen";

export const metadata = { title: "Sort entries" };

export default async function SortPage() {
  const viewer = await requireViewer();
  const unc = await ensureUncategorized(viewer.household.id);
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const entries = data.txs
    .filter((t) => t.type === "expense" && t.categoryId === unc.id)
    .map((t) => ({ id: t.id, date: t.date, amountCents: t.amountCents, note: t.note, userId: t.userId }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 pt-2">
        <Link href="/activity" aria-label="Back" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-card-2">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="display text-2xl font-semibold tracking-tight">Sort entries</h1>
      </div>
      <SortScreen
        entries={entries}
        categories={data.categories.filter((c) => c.kind === "expense" && !c.archived && c.id !== unc.id).map((c) => ({ id: c.id, name: c.name, icon: c.icon, group: c.group }))}
        subcategories={data.subcategories.filter((s) => !s.archived).map((s) => ({ id: s.id, categoryId: s.categoryId, name: s.name }))}
        members={data.members.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
        today={viewer.today}
        uncategorizedId={unc.id}
      />
    </div>
  );
}
