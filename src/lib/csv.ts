/**
 * Hearth history CSV: the format ChatGPT produces from a bank export or a spreadsheet,
 * and the app imports. One row per entry.
 *
 *   date,type,category,subcategory,amount,note,paid_by
 *   2026-07-01,expense,Groceries,Meat & fish,23.40,Costco,Sam
 *   2026-07-01,income,Paycheck,,3250.00,ACME payroll,
 *
 * Columns are matched by header name (any order; "subcategory", "note" and "paid_by" optional).
 * Tabs and semicolons work as delimiters too, so cells pasted from Excel are fine.
 */
import { toISODate, normalizeName, type MatchCategory, type MatchSub } from "./receipt-parse";

export const CSV_HEADER = "date,type,category,subcategory,amount,note,paid_by";

/** RFC-4180-ish parser: quoted fields, escaped quotes, newlines inside quotes; delimiter auto-detected. */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const delimiter = [",", "\t", ";"].map((d) => ({ d, n: firstLine.split(d).length })).sort((a, b) => b.n - a.n)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((f) => f.trim()));
}

export interface CsvRow {
  line: number;
  date: string | null;
  type: "expense" | "income" | null;
  categoryName: string;
  subcategoryName: string;
  amountCents: number | null;
  note: string;
  paidBy: string;
  /** Resolved against the household. */
  categoryId: string | null;
  subcategoryId: string | null;
  userId: string | null;
  problem: string | null;
}

export interface CsvParse {
  rows: CsvRow[];
  /** Category names that matched nothing, with the number of rows using them. */
  unmatched: { name: string; type: "expense" | "income"; count: number }[];
  problems: string[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "transaction date", "posted", "posting date", "day"],
  type: ["type", "kind", "direction"],
  category: ["category", "cat"],
  subcategory: ["subcategory", "sub", "sub category", "subcat", "detail"],
  amount: ["amount", "sum", "total", "value"],
  note: ["note", "notes", "description", "memo", "payee", "merchant", "store"],
  paid_by: ["paid_by", "paid by", "member", "who", "user"],
};

function findColumn(headers: string[], key: string): number {
  const names = HEADER_ALIASES[key];
  const idx = headers.findIndex((h) => names.includes(h.toLowerCase().trim()));
  return idx;
}

function bestName<T extends { name: string }>(label: string, items: T[]): T | null {
  const n = normalizeName(label);
  if (!n) return null;
  return (
    items.find((i) => normalizeName(i.name) === n) ??
    items.find((i) => normalizeName(i.name).startsWith(n) || n.startsWith(normalizeName(i.name))) ??
    null
  );
}

export function parseHistoryCsv(
  text: string,
  categories: MatchCategory[],
  subs: MatchSub[],
  members: { id: string; name: string }[],
  /** Manual mapping for category names the household doesn't have: name → categoryId. */
  remap: Record<string, string> = {},
): CsvParse {
  const out: CsvParse = { rows: [], unmatched: [], problems: [] };
  const table = parseDelimited(text);
  if (table.length === 0) return out;

  const headers = table[0].map((h) => h.toLowerCase());
  const col = {
    date: findColumn(headers, "date"),
    type: findColumn(headers, "type"),
    category: findColumn(headers, "category"),
    subcategory: findColumn(headers, "subcategory"),
    amount: findColumn(headers, "amount"),
    note: findColumn(headers, "note"),
    paidBy: findColumn(headers, "paid_by"),
  };
  if (col.date === -1 || col.amount === -1 || col.category === -1) {
    out.problems.push(`The first row must be a header with at least "date", "category" and "amount" (found: ${table[0].join(", ") || "nothing"}).`);
    return out;
  }

  const unmatchedCount = new Map<string, { type: "expense" | "income"; count: number }>();
  const live = categories.filter((c) => !c.archived);

  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");
    const rawType = get(col.type).toLowerCase();
    const amountRaw = get(col.amount);
    const parsedAmount = amountRaw ? Number(amountRaw.replace(/[^0-9.-]/g, "").replace(/^\((.*)\)$/, "-$1")) : NaN;
    const negative = /^\(.*\)$/.test(amountRaw) || parsedAmount < 0;
    const amountCents = Number.isFinite(parsedAmount) ? Math.round(Math.abs(parsedAmount) * 100) : null;
    const type: CsvRow["type"] = rawType.startsWith("inc") || rawType === "credit" || rawType === "deposit" ? "income" : rawType.startsWith("exp") || rawType === "debit" || rawType === "spend" ? "expense" : rawType === "" ? (negative ? "expense" : "expense") : null;
    const categoryName = get(col.category);
    const subcategoryName = get(col.subcategory);
    const date = toISODate(get(col.date));
    const paidBy = get(col.paidBy);

    const row: CsvRow = {
      line,
      date,
      type,
      categoryName,
      subcategoryName,
      amountCents,
      note: get(col.note).slice(0, 200),
      paidBy,
      categoryId: null,
      subcategoryId: null,
      userId: paidBy ? (members.find((m) => normalizeName(m.name) === normalizeName(paidBy))?.id ?? null) : null,
      problem: null,
    };

    if (!date) row.problem = `couldn't read the date "${get(col.date)}"`;
    else if (!amountCents) row.problem = `amount "${amountRaw}" is missing or zero`;
    else if (!type) row.problem = `type "${rawType}" should be expense or income`;
    else if (!categoryName) row.problem = "category is empty";
    else {
      const kind = type;
      const cat = remap[categoryName] ? live.find((c) => c.id === remap[categoryName]) ?? null : bestName(categoryName, live.filter((c) => c.kind === kind));
      if (cat) {
        row.categoryId = cat.id;
        if (subcategoryName) {
          const sub = bestName(subcategoryName, subs.filter((s) => s.categoryId === cat.id && !s.archived));
          row.subcategoryId = sub?.id ?? null;
          if (!sub) row.note = [subcategoryName, row.note].filter(Boolean).join(" · ").slice(0, 200);
        }
      } else {
        const u = unmatchedCount.get(categoryName) ?? { type: kind, count: 0 };
        u.count += 1;
        unmatchedCount.set(categoryName, u);
        row.problem = `no category like "${categoryName}"`;
      }
    }
    out.rows.push(row);
  });

  out.unmatched = [...unmatchedCount.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count);
  return out;
}

/** The prompt a family member pastes into ChatGPT together with a bank export or spreadsheet. */
export function historyPrompt(categories: MatchCategory[], subs: MatchSub[], members: { name: string }[]): string {
  const expense = categories
    .filter((c) => c.kind === "expense" && !c.archived)
    .map((c) => {
      const names = subs.filter((s) => s.categoryId === c.id && !s.archived).map((s) => s.name);
      return names.length ? `${c.name}: ${names.join(", ")}` : c.name;
    })
    .join("\n");
  const income = categories
    .filter((c) => c.kind === "income" && !c.archived)
    .map((c) => c.name)
    .join(", ");
  return `Convert my transaction history (bank export, credit card statement, or my spreadsheet) into a CSV for my family budget app.

Expense categories (use these exact names; subcategories after the colon, pick one when it fits):
${expense}

Income categories: ${income}
Family members: ${members.map((m) => m.name).join(", ")}

Rules:
- One row per transaction. Output ONLY the CSV, starting with this exact header line:
${CSV_HEADER}
- date in YYYY-MM-DD. type is "expense" or "income". amount is positive with two decimals, no currency sign.
- note: a short clean merchant or description (e.g. "Costco", "ACME payroll"), not the raw bank text.
- paid_by: one of the family members if you can tell from the account, otherwise leave empty.
- Skip transfers between our own accounts, credit card payments, and refunds that only reverse another row.
- Every category must be one of the names above, and pick the subcategory whenever one clearly fits.
- When you are not sure where a row belongs, do NOT guess: use the category "Uncategorized" with an empty subcategory. I will sort those by hand. A clean "Uncategorized" is better than a wrong category.
- Quote any field that contains a comma.`;
}
