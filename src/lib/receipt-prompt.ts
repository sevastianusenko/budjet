import type { MatchCategory, MatchSub } from "./receipt-parse";

/** "Groceries: Meat & fish, Vegetables & fruit, …" one line per expense category. */
export function categoryList(categories: MatchCategory[], subs: MatchSub[]): string {
  return categories
    .filter((c) => c.kind === "expense" && !c.archived)
    .map((c) => {
      const names = subs.filter((s) => s.categoryId === c.id && !s.archived).map((s) => s.name);
      return names.length ? `${c.name}: ${names.join(", ")}` : c.name;
    })
    .join("\n");
}

export const OUTPUT_FORMAT = `date: YYYY-MM-DD
store: name of the store
Category / Subcategory: amount
  - item name, quantity unit @ price per unit = amount
  - item name, quantity each @ price = amount
Category / Subcategory: amount
  - item name = amount
total: amount`;

/** The prompt a family member pastes into ChatGPT (or any assistant) together with the receipt photo. */
export function chatgptPrompt(categories: MatchCategory[], subs: MatchSub[]): string {
  return `Read this receipt photo and sort every purchase into my family budget categories, keeping each item.

My categories (use these exact names; subcategories are listed after the colon):
${categoryList(categories, subs)}

Rules:
- One line per subcategory with its total, then each item under it on its own indented line starting with "- ".
- For every item give the name as printed (expand abbreviations if obvious), the quantity and unit when the receipt shows them (lb, oz, each, gal…), the price per unit, and the item total. Items under a line must add up to that line.
- If a category has subcategories, always pick one; if nothing fits, use the category alone.
- If you can't tell where an item belongs, put it under "Uncategorized" instead of guessing; I will sort it by hand.
- Put sales tax and fees proportionally into the item amounts so the lines add up to the receipt total.
- Amounts in dollars with two decimals, no currency sign.
- Output ONLY in this format, nothing else, no explanations:

${OUTPUT_FORMAT}`;
}
