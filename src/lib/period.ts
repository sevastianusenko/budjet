import { addMonths, dateInMonth, isValidMonth, monthLabel, monthOf, type ISODate, type Month } from "./dates";

export type PeriodKind = "month" | "quarter" | "year";

export interface Period {
  kind: PeriodKind;
  /** "2026-10", "2026-Q4" or "2026" */
  key: string;
  label: string;
  months: Month[];
  start: ISODate;
  end: ISODate;
  prevKey: string;
  nextKey: string;
}

function quarterOf(m: Month): number {
  return Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1;
}

export function periodFromKey(kind: PeriodKind, key: string | undefined, today: ISODate): Period {
  const cur = monthOf(today);
  if (kind === "year") {
    const y = key && /^\d{4}$/.test(key) ? Number(key) : Number(cur.slice(0, 4));
    const months = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
    return { kind, key: String(y), label: String(y), months, start: `${y}-01-01`, end: `${y}-12-31`, prevKey: String(y - 1), nextKey: String(y + 1) };
  }
  if (kind === "quarter") {
    const m = key?.match(/^(\d{4})-Q([1-4])$/);
    const y = m ? Number(m[1]) : Number(cur.slice(0, 4));
    const q = m ? Number(m[2]) : quarterOf(cur);
    const first = `${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}`;
    const months = [first, addMonths(first, 1), addMonths(first, 2)];
    const prev = q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
    const next = q === 4 ? `${y + 1}-Q1` : `${y}-Q${q + 1}`;
    return { kind, key: `${y}-Q${q}`, label: `Q${q} ${y}`, months, start: `${first}-01`, end: dateInMonth(months[2], 31), prevKey: prev, nextKey: next };
  }
  const mo = key && isValidMonth(key) ? key : cur;
  return { kind: "month", key: mo, label: monthLabel(mo), months: [mo], start: `${mo}-01`, end: dateInMonth(mo, 31), prevKey: addMonths(mo, -1), nextKey: addMonths(mo, 1) };
}

export function resolvePeriod(sp: Record<string, string | string[] | undefined>, today: ISODate): Period {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const kindRaw = one(sp.period);
  const kind: PeriodKind = kindRaw === "quarter" || kindRaw === "year" ? kindRaw : "month";
  return periodFromKey(kind, one(sp.key), today);
}

export function periodHref(kind: PeriodKind, key: string): string {
  return `/report?period=${kind}&key=${encodeURIComponent(key)}`;
}
