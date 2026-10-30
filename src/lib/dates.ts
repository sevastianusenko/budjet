/** Dates are plain strings: ISODate = "YYYY-MM-DD", Month = "YYYY-MM". No timezone math anywhere else. */
export type ISODate = string;
export type Month = string;

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DEFAULT_TZ = "America/New_York";

/** Today's date in the given IANA timezone. */
export function todayIn(tz: string | undefined): ISODate {
  try {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || DEFAULT_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function isValidISODate(s: unknown): s is ISODate {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(`${s.slice(0, 4)}-${s.slice(5, 7)}`) && y > 1900;
}

export function isValidMonth(s: unknown): s is Month {
  if (typeof s !== "string" || !/^\d{4}-\d{2}$/.test(s)) return false;
  const m = Number(s.slice(5, 7));
  return m >= 1 && m <= 12;
}

export function monthOf(d: ISODate): Month {
  return d.slice(0, 7);
}

export function dayOf(d: ISODate): number {
  return Number(d.slice(8, 10));
}

export function daysInMonth(m: Month): number {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

export function addMonths(m: Month, n: number): Month {
  const [y, mo] = m.split("-").map(Number);
  const total = y * 12 + (mo - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return t.toISOString().slice(0, 10);
}

/** Whole months between two months (b - a). */
export function monthsBetween(a: Month, b: Month): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

/** Last n months ending at `end` (inclusive), oldest first. */
export function lastMonths(end: Month, n: number): Month[] {
  const out: Month[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addMonths(end, -i));
  return out;
}

/** Clamp a day-of-month (e.g. a bill due on the 31st) into the month. */
export function dateInMonth(m: Month, day: number): ISODate {
  const d = Math.min(Math.max(1, day), daysInMonth(m));
  return `${m}-${String(d).padStart(2, "0")}`;
}

export function monthRange(m: Month): { start: ISODate; end: ISODate } {
  return { start: `${m}-01`, end: dateInMonth(m, 31) };
}

export function monthLabel(m: Month, style: "long" | "short" = "long"): string {
  const [y, mo] = m.split("-").map(Number);
  return style === "long" ? `${MONTHS_LONG[mo - 1]} ${y}` : MONTHS_SHORT[mo - 1];
}

export function weekdayOf(d: ISODate): number {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

/** "Today", "Yesterday", or "Mon, Oct 27" (with year when it differs). */
export function dateLabel(d: ISODate, today: ISODate): string {
  if (d === today) return "Today";
  if (d === addDays(today, -1)) return "Yesterday";
  const [y, m, day] = d.split("-").map(Number);
  const base = `${DAYS_SHORT[weekdayOf(d)]}, ${MONTHS_SHORT[m - 1]} ${day}`;
  return y === Number(today.slice(0, 4)) ? base : `${base}, ${y}`;
}

export function shortDate(d: ISODate): string {
  const [, m, day] = d.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${day}`;
}
