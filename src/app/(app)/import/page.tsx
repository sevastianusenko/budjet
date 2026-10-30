import { requireViewer } from "@/lib/auth";
import { loadHousehold } from "@/lib/queries";
import { chatgptPrompt } from "@/lib/receipt-prompt";
import { ImportScreen } from "@/components/import/ImportScreen";

export const metadata = { title: "Import a receipt" };

export default async function ImportPage() {
  const viewer = await requireViewer();
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const categories = data.categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, kind: c.kind, archived: c.archived }));
  const subs = data.subcategories.map((s) => ({ id: s.id, categoryId: s.categoryId, name: s.name, archived: s.archived }));
  return (
    <ImportScreen
      categories={categories}
      subcategories={subs}
      members={data.members.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
      meId={viewer.user.id}
      today={viewer.today}
      prompt={chatgptPrompt(categories, subs)}
    />
  );
}
