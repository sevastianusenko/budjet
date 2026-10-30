import { requireViewer } from "@/lib/auth";
import { loadHousehold } from "@/lib/queries";
import { historyPrompt } from "@/lib/csv";
import { CsvImportScreen } from "@/components/import/CsvImportScreen";

export const metadata = { title: "Import history" };

export default async function CsvImportPage() {
  const viewer = await requireViewer();
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const categories = data.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, archived: c.archived }));
  const subs = data.subcategories.map((s) => ({ id: s.id, categoryId: s.categoryId, name: s.name, archived: s.archived }));
  const members = data.members.map((m) => ({ id: m.id, name: m.name, color: m.color }));
  return (
    <CsvImportScreen
      categories={categories}
      subcategories={subs}
      members={members}
      meId={viewer.user.id}
      tithePct={viewer.household.tithePct}
      prompt={historyPrompt(categories, subs, members)}
    />
  );
}
