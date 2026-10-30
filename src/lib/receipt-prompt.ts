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
Category / Subcategory: amount
total: amount`;

/** The prompt a family member pastes into ChatGPT (or any assistant) together with the receipt photo. */
export function chatgptPrompt(categories: MatchCategory[], subs: MatchSub[]): string {
  return `Read this receipt photo and sort every line item into my family budget categories.

My categories (use these exact names; subcategories are listed after the colon):
${categoryList(categories, subs)}

Rules:
- Sum the items that belong to the same subcategory into one line.
- If a category has subcategories, always pick one; if nothing fits, use the category alone.
- Put sales tax and fees proportionally into the lines (or into the largest line).
- Amounts in dollars with two decimals, no currency sign.
- Output ONLY these lines, nothing else, no explanations:

${OUTPUT_FORMAT}`;
}

/** System prompt for the in-app scan (Claude vision). Asks for JSON the app parses directly. */
export function scanSystemPrompt(categories: MatchCategory[], subs: MatchSub[], today: string): string {
  return `You read receipt photos for a family budgeting app and sort the purchases into the household's categories.

Household categories (exact names; subcategories after the colon):
${categoryList(categories, subs)}

Today's date is ${today}. Respond with JSON only, no markdown, no commentary:
{"date":"YYYY-MM-DD or null","store":"string or null","total":number or null,"items":[{"category":"exact category name","subcategory":"exact subcategory name or null","amount":number,"note":"short description of what's in this line"}]}

Rules:
- Group items that belong to the same subcategory into one item; use the receipt's grouping only as a hint.
- If a category has subcategories, pick the best one; otherwise leave subcategory null.
- Spread tax and fees proportionally into the items so the items add up to the receipt total.
- Amounts in dollars as numbers. Use the receipt's own total when printed.
- If the photo is not a receipt or is unreadable, respond {"error":"short reason"}.`;
}
