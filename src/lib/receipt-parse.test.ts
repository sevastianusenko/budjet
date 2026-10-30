import { describe, expect, it } from "vitest";
import { describeItem, parseItem, parseReceiptText, toISODate, type MatchCategory, type MatchSub } from "./receipt-parse";

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
  it("reads the ChatGPT line format with items, date, store and total", () => {
    const r = parseReceiptText(
      `date: 2026-10-30
store: Costco
Groceries / Meat & fish: 23.40
  - Chicken thighs, 3.2 lb @ 2.99/lb = 9.57
  - Ground beef 85%, 2 lb @ $6.92/lb = 13.83
Groceries / Vegetables & fruit: $15.10
  - Bananas, 2.5 lb @ 0.59/lb = 1.48
  - Avocados, 4 each @ 1.54 = 6.15
  - Apples Honeycrisp = 7.47
Home & Supplies / Cleaning & supplies: 8.99
total: 47.49`,
      cats,
      subs,
    );
    expect(r.date).toBe("2026-10-30");
    expect(r.store).toBe("Costco");
    expect(r.totalCents).toBe(4749);
    expect(r.lines.map((l) => [l.categoryId, l.subcategoryId, l.amountCents, l.items.length])).toEqual([
      ["groc", "meat", 2340, 2],
      ["groc", "veg", 1510, 3],
      ["home", "clean", 899, 0],
    ]);
    expect(r.lines[0].items[0]).toEqual({ name: "Chicken thighs", qty: 3.2, unit: "lb", unitPriceCents: 299, amountCents: 957 });
    expect(r.lines[0].items[1]).toMatchObject({ name: "Ground beef 85%", qty: 2, unit: "lb", unitPriceCents: 692, amountCents: 1383 });
    expect(r.lines[1].items[1]).toMatchObject({ name: "Avocados", qty: 4, unit: "each", unitPriceCents: 154, amountCents: 615 });
    expect(r.lines[1].items[2]).toMatchObject({ name: "Apples Honeycrisp", qty: null, unit: null, unitPriceCents: null, amountCents: 747 });
    expect(r.sumCents).toBe(4749);
    expect(r.problems).toEqual([]);
  });

  it("matches loosely: case, '&' vs 'and', a subcategory alone, bullets without a parent line", () => {
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

  it("warns when items don't add up to their line", () => {
    const r = parseReceiptText(`Groceries / Meat & fish: 20\n  - Chicken 5\n  - Beef 5`, cats, subs);
    expect(r.lines[0].items).toHaveLength(2);
    expect(r.problems[0]).toMatch(/items add up to 10.00/);
  });

  it("accepts CSV and JSON with nested items", () => {
    const csv = parseReceiptText(`category,subcategory,amount\nGroceries,Meat & fish,10.00\nDining Out,,5`, cats, subs);
    expect(csv.lines).toHaveLength(2);
    expect(csv.lines[0]).toMatchObject({ categoryId: "groc", subcategoryId: "meat", amountCents: 1000 });
    const json = parseReceiptText(
      JSON.stringify({
        date: "10/01/2026",
        store: "Giant",
        total: 15.5,
        items: [{ category: "Groceries", subcategory: "Meat & fish", amount: 15.5, note: "chicken", items: [{ name: "Chicken", qty: 2, unit: "lb", unitPrice: 7.75, amount: 15.5 }] }],
      }),
      cats,
      subs,
    );
    expect(json.date).toBe("2026-10-01");
    expect(json.lines[0]).toMatchObject({ categoryId: "groc", subcategoryId: "meat", amountCents: 1550, note: "chicken" });
    expect(json.lines[0].items[0]).toEqual({ name: "Chicken", qty: 2, unit: "lb", unitPriceCents: 775, amountCents: 1550 });
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

describe("parseItem / describeItem", () => {
  it("derives the unit price when only quantity is given", () => {
    expect(parseItem("Milk 2 gal 8.58")).toEqual({ name: "Milk", qty: 2, unit: "gal", unitPriceCents: 429, amountCents: 858 });
    expect(parseItem("Eggs x2 7.98")).toMatchObject({ name: "Eggs", qty: 2, unit: "each", unitPriceCents: 399 });
    expect(parseItem("Bread 3.49")).toEqual({ name: "Bread", qty: null, unit: null, unitPriceCents: null, amountCents: 349 });
    expect(parseItem("no amount here")).toBeNull();
  });

  it("formats quantity and unit price", () => {
    expect(describeItem({ qty: 3.2, unit: "lb", unitPriceCents: 299 })).toBe("3.2 lb @ $2.99/lb");
    expect(describeItem({ qty: 4, unit: "each", unitPriceCents: 154 })).toBe("4 each @ $1.54");
    expect(describeItem({ qty: null, unit: null, unitPriceCents: null })).toBe("");
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
