import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { requireViewer } from "@/lib/auth";
import { loadHousehold } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  if (!viewer.household.onboardedAt) redirect("/onboarding");

  const data = await loadHousehold(viewer.household.id, viewer.today);
  const uses = new Map<string, number>();
  const subUses = new Map<string, number>();
  for (const t of data.txs) {
    if (t.categoryId) uses.set(t.categoryId, (uses.get(t.categoryId) ?? 0) + 1);
    if (t.subcategoryId) subUses.set(t.subcategoryId, (subUses.get(t.subcategoryId) ?? 0) + 1);
  }

  return (
    <AppShell
      me={{ id: viewer.user.id, name: viewer.user.name, color: viewer.user.color }}
      members={data.members.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
      categories={data.categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        kind: c.kind,
        group: c.group,
        archived: c.archived,
        uses: uses.get(c.id) ?? 0,
      }))}
      subcategories={data.subcategories.map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        name: s.name,
        archived: s.archived,
        uses: subUses.get(s.id) ?? 0,
      }))}
      goals={data.goals.map((g) => ({ id: g.id, name: g.name, icon: g.icon, archived: g.archived }))}
      today={viewer.today}
    >
      {children}
    </AppShell>
  );
}
