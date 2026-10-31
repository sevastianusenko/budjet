import { describe, expect, it } from "vitest";
import { chatgptPrompt, scanPrompt } from "./receipt-prompt";
import type { MatchCategory, MatchSub } from "./receipt-parse";

const cats: MatchCategory[] = [
  { id: "g", name: "Groceries", kind: "expense", archived: false },
  { id: "old", name: "Old stuff", kind: "expense", archived: true },
  { id: "pay", name: "Paycheck", kind: "income", archived: false },
];
const subs: MatchSub[] = [{ id: "m", categoryId: "g", name: "Meat & fish", archived: false }];

describe("receipt prompts", () => {
  it("lists live expense categories with their subcategories and ends with the format", () => {
    const p = chatgptPrompt(cats, subs);
    expect(p).toContain("Groceries: Meat & fish");
    expect(p).not.toContain("Paycheck");
    expect(p).not.toContain("Old stuff");
    expect(p.trim().endsWith("total: amount")).toBe(true);
  });
  it("the scan prompt adds today's date and the error line, same rules otherwise", () => {
    const p = scanPrompt(cats, subs, "2026-10-31");
    expect(p).toContain("Today is 2026-10-31");
    expect(p).toContain('"error: "');
    expect(p).toContain("Groceries: Meat & fish");
    expect(p).toContain("Uncategorized");
  });
});
