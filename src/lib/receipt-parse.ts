/**
 * Turns pasted receipt text (from ChatGPT, Claude, a scanner, or typed by hand)
 * into entry candidates matched against the household's categories, keeping the
 * item detail under each line.
 *
 * Accepted shapes (case-insensitive, "$" and thousands separators ok):
 *   date: 2026-10-30        store: Costco        total: 47.49
 *   Groceries / Meat & fish: 23.40                 <- an entry line
 *     - Chicken thighs, 3.2 lb @ 2.99/lb = 9.57    <- an item of that line (indented or bulleted)
 *     - Ground beef, 2 lb @ 6.92/lb = 13.83
 *   Groceries: 47.49 · Meat & fish, 23.40 · category,subcategory,amount (CSV)
 * JSON {date, store, total, items:[{category, subcategory, amount, note, items:[{name, qty, unit, unitPrice, amount}]}]} is accepted too.
 */
import { isValidISODate, type ISODate } from "./dates";

export interface MatchCategory {
  id: string;
  name: string;
  kind: "expense" | "income";
  archived: boolean;
}
export interface MatchSub {
  id: string;
  categoryId: string;
  name: string;
  archived: boolean;
}

export interface ParsedItem {
  name: string;
  qty: number | null;
  unit: string | null;
  unitPriceCents: number | null;
  amountCents: number;
}

export interface ParsedLine {
  /** 1-based line number in the pasted text, for error messages. */
  line: number;
  raw: string;
  amountCents: number;
  categoryId: string | null;
  subcategoryId: string | null;
  /** The label text as written, when no category matched. */
  unmatched: string | null;
  note: string;
  items: ParsedItem[];
}

export interface ParsedReceipt {
  lines: ParsedLine[];
  date: ISODate | null;
  store: string | null;
  /** The receipt's stated total, if the text had one. */
  totalCents: number | null;
  /** Sum of the parsed lines. */
  sumCents: number;
  problems: string[];
}

const AMOUNT_AT_END = /(?:=\s*)?\$?\s*(-?\d[\d,]*(?:\.\d{1,2})?)\s*$/;
const UNITS = "lbs?|oz|kg|g|each|ea|pcs?|ct|gal|qt|pt|l|ml|pack|pk|bag|dz|doz|bunch";
const QTY = new RegExp(`(?:^|[\\s,])(\\d+(?:\\.\\d+)?)\\s*(${UNITS})\\b`, "i");
const QTY_X = /(?:^|[\s,])(?:x\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*x)(?=[\s,@$]|$)/i;
const UNIT_PRICE = new RegExp(`@\\s*\\$?(\\d+(?:\\.\\d+)?)(?:\\s*(?:/|per)\\s*(${UNITS}))?`, "i");

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeUnit(u: string | null | undefined): string | null {
  if (!u) return null;
  const n = u.toLowerCase();
  if (n === "lbs") return "lb";
  if (n === "ea" || n === "pc" || n === "pcs" || n === "ct") return "each";
  if (n === "pk") return "pack";
  if (n === "dz" || n === "doz") return "dozen";
  return n;
}

/** Exact, then prefix, then word-overlap match against a list of names. */
function bestMatch<T extends { name: string }>(label: string, items: T[]): T | null {
  const n = normalizeName(label);
  if (!n) return null;
  const exact = items.find((i) => normalizeName(i.name) === n);
  if (exact) return exact;
  const starts = items.find((i) => normalizeName(i.name).startsWith(n) || n.startsWith(normalizeName(i.name)));
  if (starts) return starts;
  const words = new Set(n.split(" ").filter((w) => w.length > 2));
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const iw = normalizeName(item.name).split(" ").filter((w) => w.length > 2);
    const score = iw.filter((w) => words.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}

export function parseAmount(s: string): number | null {
  const m = s.replace(/[^\d.,-]/g, "");
  if (!m) return null;
  const n = Number(m.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.abs(n) * 100);
}

/** "Chicken thighs, 3.2 lb @ 2.99/lb = 9.57" → name, qty, unit, unit price, amount. */
export function parseItem(text: string): ParsedItem | null {
  const row = text.replace(/^[\s•*\-–—]+/, "").trim();
  const m = row.match(AMOUNT_AT_END);
  if (!m) return null;
  const amountCents = parseAmount(m[1]);
  if (!amountCents) return null;
  let rest = row.slice(0, m.index).replace(/[\s=:\-–—|,]+$/, "").trim();

  let unitPriceCents: number | null = null;
  let unit: string | null = null;
  const up = rest.match(UNIT_PRICE);
  if (up) {
    unitPriceCents = parseAmount(up[1]);
    unit = normalizeUnit(up[2]);
    rest = (rest.slice(0, up.index) + " " + rest.slice((up.index ?? 0) + up[0].length)).trim();
  }

  let qty: number | null = null;
  const q = rest.match(QTY);
  if (q) {
    qty = Number(q[1]);
    unit = unit ?? normalizeUnit(q[2]);
    rest = (rest.slice(0, q.index) + " " + rest.slice((q.index ?? 0) + q[0].length)).trim();
  } else {
    const qx = rest.match(QTY_X);
    if (qx) {
      qty = Number(qx[1] ?? qx[2]);
      unit = unit ?? "each";
      rest = (rest.slice(0, qx.index) + " " + rest.slice((qx.index ?? 0) + qx[0].length)).trim();
    }
  }
  if (qty !== null && unit === null) unit = "each";
  if (qty !== null && unitPriceCents === null && qty > 0) unitPriceCents = Math.round(amountCents / qty);

  const name = rest.replace(/[\s,;:\-–—|]+$/, "").replace(/^[\s,;:\-–—|]+/, "").trim();
  return { name: name || "Item", qty, unit, unitPriceCents, amountCents };
}

function isItemLike(rawRow: string): boolean {
  return /^(\s{2,}|\t)/.test(rawRow) || /^\s*[•*\-–—]\s+/.test(rawRow);
}

export function parseReceiptText(text: string, categories: MatchCategory[], subs: MatchSub[]): ParsedReceipt {
  const cats = categories.filter((c) => c.kind === "expense" && !c.archived);
  const liveSubs = subs.filter((s) => !s.archived);
  const out: ParsedReceipt = { lines: [], date: null, store: null, totalCents: null, sumCents: 0, problems: [] };

  const trimmed = text.trim();
  if (!trimmed) return out;

  // JSON input (from an API or a structured assistant answer)
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed) as unknown;
      const list = Array.isArray(data) ? data : ((data as { items?: unknown[] }).items ?? []);
      const obj = Array.isArray(data) ? {} : (data as Record<string, unknown>);
      if (typeof obj.date === "string") out.date = toISODate(obj.date);
      if (typeof obj.store === "string") out.store = obj.store.trim() || null;
      if (typeof obj.total === "number") out.totalCents = Math.round(obj.total * 100);
      list.forEach((it, i) => {
        const r = it as Record<string, unknown>;
        const amount = typeof r.amount === "number" ? Math.round(r.amount * 100) : parseAmount(String(r.amount ?? ""));
        if (!amount) return;
        const label = [r.category, r.subcategory].filter(Boolean).join(" / ");
        const line = resolve(i + 1, label, amount, String(r.note ?? ""), cats, liveSubs);
        const items = Array.isArray(r.items) ? r.items : [];
        for (const raw of items) {
          const x = raw as Record<string, unknown>;
          const a = typeof x.amount === "number" ? Math.round(x.amount * 100) : parseAmount(String(x.amount ?? ""));
          if (!a) continue;
          const qty = typeof x.qty === "number" ? x.qty : null;
          line.items.push({
            name: String(x.name ?? "Item"),
            qty,
            unit: normalizeUnit(typeof x.unit === "string" ? x.unit : null) ?? (qty !== null ? "each" : null),
            unitPriceCents: typeof x.unitPrice === "number" ? Math.round(x.unitPrice * 100) : qty ? Math.round(a / qty) : null,
            amountCents: a,
          });
        }
        out.lines.push(line);
      });
      finish(out);
      return out;
    } catch {
      /* fall through to line parsing */
    }
  }

  const rows = trimmed.split(/\r?\n/);
  let current: ParsedLine | null = null;
  rows.forEach((rawRow, idx) => {
    const row = rawRow.replace(/^[\s•*\-–—]+/, "").trim();
    if (!row) return;

    const meta = row.match(/^(date|store|merchant|shop|total|sum)\s*[:=]\s*(.+)$/i);
    if (meta) {
      const key = meta[1].toLowerCase();
      const value = meta[2].trim();
      if (key === "date") {
        const iso = toISODate(value);
        if (iso) out.date = iso;
        else out.problems.push(`Line ${idx + 1}: couldn't read the date "${value}".`);
      } else if (key === "total" || key === "sum") {
        out.totalCents = parseAmount(value);
      } else {
        out.store = value.replace(/^["']|["']$/g, "") || null;
      }
      return;
    }
    if (/^(category|item|subcategory)\b.*amount/i.test(row)) return; // CSV header

    // An indented row under an entry is one of its items. A bulleted-but-not-indented row is an
    // item only when its label is not a category (bullet lists of categories are common too).
    if (current && isItemLike(rawRow) && !/\s\/\s/.test(row)) {
      const indented = /^(\s{2,}|\t)/.test(rawRow);
      let treatAsItem = indented;
      if (!indented) {
        const probe = row.match(AMOUNT_AT_END);
        const label = probe ? row.slice(0, probe.index).replace(/[\s:=\-–—|,]+$/, "").trim() : "";
        treatAsItem = !probe || !resolve(idx + 1, label, 1, "", cats, liveSubs).categoryId;
      }
      if (treatAsItem) {
        const item = parseItem(row);
        if (item) current.items.push(item);
        else out.problems.push(`Line ${idx + 1}: no amount found in item "${row}".`);
        return;
      }
    }

    // CSV: category, subcategory, amount[, note]
    const csv = row.split(/\s*,\s*/);
    if (csv.length >= 3 && AMOUNT_AT_END.test(csv[csv.length - 1]) && !/[:>/|]/.test(row)) {
      const amount = parseAmount(csv[csv.length - 1]);
      if (amount) {
        current = resolve(idx + 1, `${csv[0]} / ${csv[1]}`, amount, csv.slice(2, -1).join(", "), cats, liveSubs);
        out.lines.push(current);
        return;
      }
    }

    const m = row.match(AMOUNT_AT_END);
    if (!m) {
      out.problems.push(`Line ${idx + 1}: no amount found in "${row}".`);
      return;
    }
    const amount = parseAmount(m[1]);
    const label = row.slice(0, m.index).replace(/[\s:=\-–—|,]+$/, "").trim();
    if (!amount) {
      out.problems.push(`Line ${idx + 1}: amount is zero in "${row}".`);
      return;
    }
    current = resolve(idx + 1, label, amount, "", cats, liveSubs);
    out.lines.push(current);
  });

  finish(out);
  return out;
}

function finish(out: ParsedReceipt) {
  out.sumCents = out.lines.reduce((a, l) => a + l.amountCents, 0);
  if (out.totalCents !== null && out.lines.length > 0 && Math.abs(out.totalCents - out.sumCents) > 100) {
    out.problems.push(`Lines add up to ${(out.sumCents / 100).toFixed(2)} but the receipt total is ${(out.totalCents / 100).toFixed(2)}.`);
  }
  for (const l of out.lines) {
    if (l.items.length === 0) continue;
    const itemSum = l.items.reduce((a, i) => a + i.amountCents, 0);
    if (Math.abs(itemSum - l.amountCents) > 100) {
      out.problems.push(`"${l.raw}": items add up to ${(itemSum / 100).toFixed(2)} but the line says ${(l.amountCents / 100).toFixed(2)}.`);
    }
  }
}

function resolve(line: number, label: string, amountCents: number, note: string, cats: MatchCategory[], subs: MatchSub[]): ParsedLine {
  // "Category / Sub", "Category > Sub", "Category | Sub"
  const parts = label.split(/\s*[/>|]\s*/).map((p) => p.trim()).filter(Boolean);
  let categoryId: string | null = null;
  let subcategoryId: string | null = null;

  if (parts.length >= 2) {
    const cat = bestMatch(parts[0], cats);
    if (cat) {
      categoryId = cat.id;
      const sub = bestMatch(parts.slice(1).join(" "), subs.filter((s) => s.categoryId === cat.id));
      subcategoryId = sub?.id ?? null;
    }
  }
  if (!categoryId && parts.length >= 1) {
    const whole = parts.join(" ");
    // A subcategory name on its own ("Meat & fish") implies its category.
    const sub = bestMatch(whole, subs);
    const cat = bestMatch(whole, cats);
    if (cat && (!sub || normalizeName(cat.name) === normalizeName(whole))) categoryId = cat.id;
    else if (sub) {
      categoryId = sub.categoryId;
      subcategoryId = sub.id;
    } else if (cat) categoryId = cat.id;
  }

  return {
    line,
    raw: label,
    amountCents,
    categoryId,
    subcategoryId,
    unmatched: categoryId ? null : label || "(no label)",
    note: note.trim(),
    items: [],
  };
}

/** Accepts 2026-10-30, 10/30/2026, 10/30/26, Oct 30 2026, 30 Oct 2026. */
export function toISODate(value: string): ISODate | null {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v) && isValidISODate(v)) return v;
  const us = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (us) {
    const y = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
    const iso = `${y}-${String(us[1]).padStart(2, "0")}-${String(us[2]).padStart(2, "0")}`;
    return isValidISODate(iso) ? iso : null;
  }
  const t = Date.parse(v);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return isValidISODate(iso) ? iso : null;
  }
  return null;
}

/** "3.2 lb @ $2.99/lb" for display. */
export function describeItem(i: { qty: number | null; unit: string | null; unitPriceCents: number | null }): string {
  const parts: string[] = [];
  if (i.qty !== null) parts.push(`${trimNumber(i.qty)}${i.unit && i.unit !== "each" ? ` ${i.unit}` : i.unit === "each" ? " ×" : ""}`.replace(/ ×$/, " each"));
  if (i.unitPriceCents !== null && (i.qty === null || i.qty !== 1)) parts.push(`@ $${(i.unitPriceCents / 100).toFixed(2)}${i.unit && i.unit !== "each" ? `/${i.unit}` : ""}`);
  return parts.join(" ");
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
