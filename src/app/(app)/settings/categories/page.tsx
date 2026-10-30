import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { loadHousehold } from "@/lib/queries";
import { CategoriesManager } from "@/components/settings/CategoriesManager";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const viewer = await requireViewer();
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const counts = new Map<string, number>();
  const subCounts = new Map<string, number>();
  for (const t of data.txs) {
    if (t.categoryId) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    if (t.subcategoryId) subCounts.set(t.subcategoryId, (subCounts.get(t.subcategoryId) ?? 0) + 1);
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 pt-2">
        <Link href="/settings" aria-label="Back to settings" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-card-2">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="display text-2xl font-semibold tracking-tight">Categories</h1>
      </div>
      <CategoriesManager
        categories={data.categories.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          kind: c.kind,
          group: c.group,
          isFixed: c.isFixed,
          rollover: c.rollover,
          archived: c.archived,
          uses: counts.get(c.id) ?? 0,
          subs: data.subcategories
            .filter((sub) => sub.categoryId === c.id)
            .map((sub) => ({ id: sub.id, name: sub.name, archived: sub.archived, uses: subCounts.get(sub.id) ?? 0 })),
        }))}
      />
    </div>
  );
}
