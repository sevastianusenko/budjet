/** All money is integer cents (USD). */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export type MoneyOpts = {
  /** Drop cents ("$1,240" instead of "$1,240.00"). */
  whole?: boolean;
  /** Prefix + for positive values. */
  signed?: boolean;
  /** "$1.2k" for large values. */
  compact?: boolean;
};

export function fmtMoney(cents: number, opts: MoneyOpts = {}): string {
  const abs = Math.abs(cents) / 100;
  let body: string;
  if (opts.compact && abs >= 10_000) {
    body = `$${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  } else if (opts.whole || Number.isInteger(abs)) {
    body = usdWhole.format(Math.round(abs));
  } else {
    body = usd.format(abs);
  }
  if (cents < 0) return `−${body}`;
  if (opts.signed && cents > 0) return `+${body}`;
  return body;
}

/** Parse "1,234.56" / "1234" / "$12" into cents. Returns null for garbage or <= 0. */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

/** Safe ratio a/b as fraction, 0 when b is 0. */
export function ratio(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function fmtPct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}
