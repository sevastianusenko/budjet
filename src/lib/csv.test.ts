import { describe, expect, it } from "vitest";
import { parseDelimited, parseHistoryCsv } from "./csv";

const cats = [
  { id: "groc", name: "Groceries", kind: "expense" as const, archived: false },
  { id: "dine", name: "Dining Out", kind: "expense" as const, archived: false },
  { id: "pay", name: "Paycheck", kind: "income" as const, archived: false },
];
const subs = [{ id: "meat", categoryId: "groc", name: "Meat & fish", archived: false }];
const members = [
  { id: "u1", name: "Sam" },
  { id: "u2", name: "Alex" },
];

describe("parseDelimited", () => {
  it("handles quotes, escaped quotes and newlines in quotes", () => {
    expect(parseDelimited('a,"b, c","say ""hi""","line\nbreak"\n1,2,3,4')).toEqual([
      ["a", "b, c", 'say "hi"', "line\nbreak"],
      ["1", "2", "3", "4"],
    ]);
  });
  it("detects tabs (pasted from Excel) and semicolons", () => {
    expect(parseDelimited("date\ttype\n2026-01-01\texpense")).toEqual([["date", "type"], ["2026-01-01", "expense"]]);
    expect(parseDelimited("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseHistoryCsv", () => {
  it("reads the Hearth CSV and resolves categories, subcategories and members", () => {
    const r = parseHistoryCsv(
      `date,type,category,subcategory,amount,note,paid_by
2026-07-01,expense,Groceries,Meat & fish,23.40,Costco,Sam
07/02/2026,income,Paycheck,,"3,250.00",ACME payroll,
2026-07-03,expense,groceries,Produce,5.00,Giant,alex`,
      cats,
      subs,
      members,
    );
    expect(r.problems).toEqual([]);
    expect(r.rows[0]).toMatchObject({ date: "2026-07-01", type: "expense", categoryId: "groc", subcategoryId: "meat", amountCents: 2340, note: "Costco", userId: "u1" });
    expect(r.rows[1]).toMatchObject({ date: "2026-07-02", type: "income", categoryId: "pay", amountCents: 325000, userId: null });
    // unknown subcategory folds into the note instead of blocking the row
    expect(r.rows[2]).toMatchObject({ categoryId: "groc", subcategoryId: null, note: "Produce · Giant", userId: "u2" });
  });

  it("collects unknown categories and applies a remap", () => {
    const text = `date,type,category,amount\n2026-07-01,expense,Restaurants,12\n2026-07-02,expense,Restaurants,8`;
    const first = parseHistoryCsv(text, cats, subs, members);
    expect(first.unmatched).toEqual([{ name: "Restaurants", type: "expense", count: 2 }]);
    expect(first.rows.every((r) => r.problem)).toBe(true);
    const fixed = parseHistoryCsv(text, cats, subs, members, { Restaurants: "dine" });
    expect(fixed.unmatched).toEqual([]);
    expect(fixed.rows.map((r) => r.categoryId)).toEqual(["dine", "dine"]);
  });

  it("reports bad rows and a missing header", () => {
    const r = parseHistoryCsv(`date,type,category,amount\nnot a date,expense,Groceries,5\n2026-07-01,expense,Groceries,0`, cats, subs, members);
    expect(r.rows[0].problem).toMatch(/date/);
    expect(r.rows[1].problem).toMatch(/amount/);
    expect(parseHistoryCsv(`foo,bar\n1,2`, cats, subs, members).problems[0]).toMatch(/header/);
  });

  it("treats a missing type column as expenses and parentheses as amounts", () => {
    const r = parseHistoryCsv(`date,category,amount\n2026-07-01,Groceries,(12.50)`, cats, subs, members);
    expect(r.rows[0]).toMatchObject({ type: "expense", amountCents: 1250 });
  });
});
