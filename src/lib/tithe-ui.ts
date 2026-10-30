import type { Category, Subcategory } from "@/db/schema";

/** Labels fund giving by its category and subcategory ("Tithe · Church"). */
export function titheLabeler(categories: Pick<Category, "id" | "name">[], subcategories: Pick<Subcategory, "id" | "name">[]) {
  return (categoryId: string | null, subcategoryId: string | null) => {
    const cat = categories.find((c) => c.id === categoryId)?.name ?? "Giving";
    const sub = subcategoryId ? subcategories.find((s) => s.id === subcategoryId)?.name : undefined;
    return sub ? `${cat} · ${sub}` : cat;
  };
}

/** Pre-selections for the "Gave to church" / "Helped someone" buttons, based on the default names. */
export function titheDefaults(categories: Pick<Category, "id" | "name" | "archived">[], subcategories: Pick<Subcategory, "id" | "categoryId" | "name" | "archived">[]) {
  const tithe = categories.find((c) => c.name === "Tithe" && !c.archived) ?? categories.find((c) => c.name === "Gifts & Giving" && !c.archived);
  const subs = tithe ? subcategories.filter((s) => s.categoryId === tithe.id && !s.archived) : [];
  const church = subs.find((s) => /church/i.test(s.name));
  const help = subs.find((s) => /help|people|charity/i.test(s.name));
  return {
    church: { categoryId: tithe?.id, subcategoryId: church?.id },
    help: { categoryId: tithe?.id, subcategoryId: help?.id },
  };
}
