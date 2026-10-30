"use client";

import type { ReactNode } from "react";
import { fmtMoney } from "@/lib/money";
import { Explain } from "@/components/ui/Explain";

export function Section({ id, title, explain, children, aside }: { id?: string; title: string; explain: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-card bg-card p-4 shadow-card">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-[13px] font-semibold uppercase tracking-wide text-ink-3">{title}</h2>
        <div className="flex shrink-0 items-center gap-1">
          {aside}
          <Explain title={title}>{explain}</Explain>
        </div>
      </header>
      {children}
    </section>
  );
}

export function Tile({ label, value, hint, tone = "neutral", extra }: { label: string; value: string; hint?: string; tone?: "neutral" | "good" | "watch" | "bad"; extra?: ReactNode }) {
  const cls = tone === "good" ? "text-green-text" : tone === "watch" ? "text-warn" : tone === "bad" ? "text-over" : "text-ink";
  return (
    <div className="rounded-card bg-card px-4 py-3 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className={`display mt-0.5 text-2xl font-semibold tracking-tight ${cls}`}>{value}</p>
        {extra}
      </div>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dot?: boolean; dashed?: boolean }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.dashed ? (
            <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span className={`inline-block ${i.dot ? "h-2.5 w-2.5 rounded-full" : "h-2.5 w-2.5 rounded-sm"}`} style={{ backgroundColor: i.color }} />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function BarLine({ label, value, max, color, labelWidth = "3.2rem" }: { label: string; value: number; max: number; color: string; labelWidth?: string }) {
  return (
    <div className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: `${labelWidth} 1fr 3.6rem` }}>
      <span className="truncate text-ink-3">{label}</span>
      <div className="h-1.5 w-full rounded-full bg-card-2">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%`, backgroundColor: color }} />
      </div>
      <span className="num text-right text-ink-2">{fmtMoney(value, { whole: true })}</span>
    </div>
  );
}

/** "+$120 more" / "$80 less" / "about the same", judged against the reference amount. */
export function DiffLabel({ you, ref }: { you: number; ref: number }) {
  if (ref <= 0) return <span className="text-xs text-ink-3">no reference</span>;
  const pct = you / ref - 1;
  if (Math.abs(pct) < 0.1) return <span className="text-xs text-ink-3">about the same</span>;
  return pct > 0 ? (
    <span className="num text-xs font-medium text-over">+{fmtMoney(you - ref, { whole: true })} more</span>
  ) : (
    <span className="num text-xs font-medium text-green-text">{fmtMoney(ref - you, { whole: true })} less</span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, ariaLabel, size = "sm" }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; ariaLabel: string; size?: "sm" | "xs" }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex rounded-xl bg-card-2 p-1 font-medium ${size === "xs" ? "text-[12px]" : "text-[13px]"}`}>
      {options.map((o) => (
        <button key={o.id} role="tab" type="button" aria-selected={value === o.id} onClick={() => onChange(o.id)} className={`${size === "xs" ? "h-7 px-2.5" : "h-8 px-3"} flex-1 whitespace-nowrap rounded-lg ${value === o.id ? "bg-card text-ink shadow-sm" : "text-ink-2"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatusDot({ status }: { status: "good" | "watch" | "bad" | "none" | "in" | "over" | "under" }) {
  const cls = status === "good" || status === "in" ? "bg-save" : status === "watch" ? "bg-warn" : status === "bad" || status === "over" || status === "under" ? "bg-over" : "bg-line-strong";
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} aria-hidden />;
}
