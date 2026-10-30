/**
 * Turns pasted receipt text (from ChatGPT, Claude, a scanner, or typed by hand)
 * into entry candidates matched against the household's categories.
 *
 * Accepted line shapes (case-insensitive, "$" and thousands separators ok):
 *   Groceries / Meat & fish: 23.40
 *   Groceries > Meat & fish - 23.40
 *   Groceries: 47.49
 *   Meat & fish, 23.40            (subcategory alone, category inferred)
 *   date: 2026-10-30   store: Costco   total: 47.49
 * JSON arrays of {category, subcategory, amount, note} are accepted too.
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

const AMOUNT = /\$?\s*(-?\d[\d,]*(?:\.\d{1,2})?)\s*$/;

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
      const items = Array.isArray(data) ? data : ((data as { items?: unknown[] }).items ?? []);
      const obj = Array.isArray(data) ? {} : (data as Record<string, unknown>);
      if (typeof obj.date === "string" && isValidISODate(obj.date)) out.date = obj.date;
      if (typeof obj.store === "string") out.store = obj.store.trim() || null;
      if (typeof obj.total === "number") out.totalCents = Math.round(obj.total * 100);
      items.forEach((it, i) => {
        const r = it as Record<string, unknown>;
        const amount = typeof r.amount === "number" ? Math.round(r.amount * 100) : parseAmount(String(r.amount ?? ""));
        if (!amount) return;
        const label = [r.category, r.subcategory].filter(Boolean).join(" / ");
        out.lines.push(resolve(i + 1, label, amount, String(r.note ?? ""), cats, liveSubs));
      });
      finish(out);
      return out;
    } catch {
      /* fall through to line parsing */
    }
  }

  const rows = trimmed.split(/\r?\n/);
  rows.forEach((rawRow, idx) => {
    const row = rawRow.replace(/^[\s•*\-–—]+/, "").trim();
    if (!row) return;
    const lower = row.toLowerCase();

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
    if (/^(category|item|subcategory)\b.*amount/i.test(lower)) return; // CSV header

    // CSV: category, subcategory, amount[, note]
    const csv = row.split(/\s*,\s*/);
    if (csv.length >= 3 && AMOUNT.test(csv[csv.length - 1]) && !/[:>/|]/.test(row)) {
      const amount = parseAmount(csv[csv.length - 1]);
      if (amount) {
        out.lines.push(resolve(idx + 1, `${csv[0]} / ${csv[1]}`, amount, csv.slice(2, -1).join(", "), cats, liveSubs));
        return;
      }
    }

    const m = row.match(AMOUNT);
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
    out.lines.push(resolve(idx + 1, label, amount, "", cats, liveSubs));
  });

  finish(out);
  return out;
}

function finish(out: ParsedReceipt) {
  out.sumCents = out.lines.reduce((a, l) => a + l.amountCents, 0);
  if (out.totalCents !== null && out.lines.length > 0 && Math.abs(out.totalCents - out.sumCents) > 100) {
    out.problems.push(`Lines add up to ${(out.sumCents / 100).toFixed(2)} but the receipt total is ${(out.totalCents / 100).toFixed(2)}.`);
  }
}

function resolve(line: number, label: string, amountCents: number, note: string, cats: MatchCategory[], subs: MatchSub[]): ParsedLine {
  // "Category / Sub", "Category > Sub", "Category | Sub", "Category - Sub" (only when both sides match something)
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
