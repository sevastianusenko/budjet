import type { ReactNode } from "react";
import { fmtMoney, type MoneyOpts } from "@/lib/money";

export function Money({ cents, className = "", plain = false, ...opts }: { cents: number; className?: string; plain?: boolean } & MoneyOpts) {
  return <span className={`${plain ? "" : "num "}${className}`}>{fmtMoney(cents, opts)}</span>;
}

/** Colored dot with the member's initial. The one piece of saturated color in a row. */
export function MemberDot({
  color,
  name,
  size = "sm",
  title,
}: {
  color: string;
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  title?: string;
}) {
  const dims = { xs: "h-2.5 w-2.5 text-[0px]", sm: "h-5 w-5 text-[10px]", md: "h-7 w-7 text-xs", lg: "h-10 w-10 text-sm" }[size];
  return (
    <span
      title={title ?? name}
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${dims}`}
      style={{ backgroundColor: color }}
    >
      {size === "xs" ? "" : name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card bg-card p-4 shadow-card ${className}`}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{children}</h2>
      {action}
    </div>
  );
}

/** Thin progress bar. `tone` colors overspend and pace. */
export function Bar({
  value,
  max,
  tone = "green",
  marker,
  className = "",
}: {
  value: number;
  max: number;
  tone?: "green" | "over" | "warn" | "need" | "want" | "save" | "ink";
  /** 0..1 position of a small tick (e.g. expected pace). */
  marker?: number | null;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : value > 0 ? 100 : 0;
  const color = {
    green: "bg-green",
    over: "bg-over",
    warn: "bg-warn",
    need: "bg-need",
    want: "bg-want",
    save: "bg-save",
    ink: "bg-ink-2",
  }[tone];
  return (
    <div className={`relative h-1.5 w-full overflow-hidden rounded-full bg-card-2 ${className}`}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      {marker !== undefined && marker !== null && marker > 0 && marker < 1 && (
        <div className="absolute top-0 h-full w-0.5 bg-ink/40" style={{ left: `${marker * 100}%` }} />
      )}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "over" | "warn" }) {
  const cls = {
    neutral: "bg-card-2 text-ink-2",
    green: "bg-green-soft text-green-text",
    over: "bg-over-soft text-over",
    warn: "bg-warn-soft text-warn",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong px-5 py-8 text-center">
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="mt-1 text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
