import { describe, expect, it } from "vitest";
import { parseReceiptText, toISODate, type MatchCategory, type MatchSub } from "./receipt-parse";

const cats: MatchCategory[] = [
  { id: "groc", name: "Groceries", kind: "expense", archived: false },
  { id: "home", name: "Home & Supplies", kind: "expense", archived: false },
  { id: "dine", name: "Dining Out", kind: "expense", archived: false },
  { id: "pay", name: "Paycheck", kind: "income", archived: false },
];
const subs: MatchSub[] = [
  { id: "meat", categoryId: "groc", name: "Meat & fish", archived: false },
  { id: "veg", categoryId: "groc", name: "Vegetables & fruit", archived: false },
  { id: "clean", categoryId: "home", name: "Cleaning & supplies", archived: false },
];

describe("parseReceiptText", () => {
  it("reads the ChatGPT line format with date, store and total", () => {
    const r = parseReceiptText(
      `date: 2026-10-30
store: Costco
Groceries / Meat & fish: 23.40
Groceries / Vegetables & fruit: $15.10
Home & Supplies / Cleaning & supplies: 8.99
total: 47.49`,
      cats,
      subs,
    );
    expect(r.date).toBe("2026-10-30");
    expect(r.store).toBe("Costco");
    expect(r.totalCents).toBe(4749);
    expect(r.lines.map((l) => [l.categoryId, l.subcategoryId, l.amountCents])).toEqual([
      ["groc", "meat", 2340],
      ["groc", "veg", 1510],
      ["home", "clean", 899],
    ]);
    expect(r.sumCents).toBe(4749);
    expect(r.problems).toEqual([]);
  });

  it("matches loosely: case, '&' vs 'and', a subcategory alone, bullets and dashes", () => {
    const r = parseReceiptText(
      `- meat and fish 12
• vegetables & fruit - 7.5
dining out: 30
Unknown thing 4.00`,
      cats,
      subs,
    );
    expect(r.lines[0]).toMatchObject({ categoryId: "groc", subcategoryId: "meat", amountCents: 1200 });
    expect(r.lines[1]).toMatchObject({ categoryId: "groc", subcategoryId: "veg", amountCents: 750 });
    expect(r.lines[2]).toMatchObject({ categoryId: "dine", subcategoryId: null, amountCents: 3000 });
    expect(r.lines[3]).toMatchObject({ categoryId: null, unmatched: "Unknown thing", amountCents: 400 });
  });

  it("accepts CSV and JSON", () => {
    const csv = parseReceiptText(`category,subcategory,amount\nGroceries,Meat & fish,10.00\nDining Out,,5`, cats, subs);
    expect(csv.lines).toHaveLength(2);
    expect(csv.lines[0]).toMatchObject({ categoryId: "groc", subcategoryId: "meat", amountCents: 1000 });
    const json = parseReceiptText(
      JSON.stringify({ date: "2026-10-01", store: "Giant", total: 15.5, items: [{ category: "Groceries", subcategory: "Meat & fish", amount: 15.5, note: "chicken" }] }),
      cats,
      subs,
    );
    expect(json.date).toBe("2026-10-01");
    expect(json.lines[0]).toMatchObject({ categoryId: "groc", subcategoryId: "meat", amountCents: 1550, note: "chicken" });
  });

  it("flags a mismatch between lines and the stated total", () => {
    const r = parseReceiptText(`Groceries: 10\ntotal: 25`, cats, subs);
    expect(r.problems[0]).toMatch(/add up to 10.00/);
  });

  it("ignores income categories and reports lines without amounts", () => {
    const r = parseReceiptText(`Paycheck: 100\nsome text`, cats, subs);
    expect(r.lines[0].categoryId).toBeNull();
    expect(r.problems.some((p) => p.includes("no amount"))).toBe(true);
  });
});

describe("toISODate", () => {
  it("accepts common U.S. formats", () => {
    expect(toISODate("2026-10-30")).toBe("2026-10-30");
    expect(toISODate("10/30/2026")).toBe("2026-10-30");
    expect(toISODate("10/30/26")).toBe("2026-10-30");
    expect(toISODate("Oct 30 2026")).toBe("2026-10-30");
    expect(toISODate("nonsense")).toBeNull();
  });
});
