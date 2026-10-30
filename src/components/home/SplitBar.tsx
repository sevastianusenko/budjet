import type { MonthSummary } from "@/lib/calc";
import { fmtMoney, fmtPct } from "@/lib/money";
import { Explain } from "@/components/ui/Explain";

/** 50/30/20 as one stacked bar of income with target ticks. */
export function SplitBar({ summary: s }: { summary: MonthSummary }) {
  const income = s.expectedIncome;
  const parts = [
    { key: "need", label: "Needs", ...s.split.need, color: "bg-need", text: "text-need" },
    { key: "want", label: "Wants", ...s.split.want, color: "bg-want", text: "text-want" },
    { key: "savings", label: "Saving", ...s.split.savings, color: "bg-save", text: "text-save" },
  ];
  const used = parts.reduce((a, p) => a + p.actual, 0) + s.businessSpent;
  const unspent = Math.max(0, income - used);

  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">
          {s.split.need.targetShare * 100}/{s.split.want.targetShare * 100}/{s.split.savings.targetShare * 100} check
        </h2>
        <Explain title="The 50/30/20 check">
          <p>A common rule of thumb: about 50% of take-home pay to needs, 30% to wants, and 20% to saving. You can change the targets in Settings.</p>
          <p>The bar is your income for the month (planned income if set, otherwise what&apos;s been logged). Each segment is what you&apos;ve actually spent or saved in that bucket. Small ticks mark the targets.</p>
          <p>Saving = goal contributions + spending in savings categories (like retirement). For finished months, money left unspent counts as saved too.</p>
        </Explain>
      </div>

      {income > 0 ? (
        <>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-card-2">
            <div className="flex h-full">
              {parts.map((p) => (
                <div key={p.key} className={`${p.color} h-full transition-[width] duration-500`} style={{ width: `${Math.min(100, (p.actual / income) * 100)}%` }} />
              ))}
              {s.businessSpent > 0 && <div className="h-full bg-ink-3/60" style={{ width: `${Math.min(100, (s.businessSpent / income) * 100)}%` }} title="Business" />}
            </div>
            {[s.split.need.targetShare, s.split.need.targetShare + s.split.want.targetShare].map((t, i) => (
              <span key={i} className="absolute top-0 h-full w-0.5 bg-ink/50" style={{ left: `${t * 100}%` }} aria-hidden />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {parts.map((p) => {
              const over = p.key !== "savings" ? p.share > p.targetShare : p.share < p.targetShare && s.status === "past";
              return (
                <div key={p.key}>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${p.color}`} />
                    <span className="text-xs text-ink-3">{p.label}</span>
                  </div>
                  <p className={`num text-base font-semibold ${over ? "text-over" : "text-ink"}`}>
                    {fmtPct(p.share)}
                    <span className="ml-1 text-xs font-medium text-ink-3">/ {fmtPct(p.targetShare)}</span>
                  </p>
                  <p className="num text-xs text-ink-3">{fmtMoney(p.actual, { whole: true })}</p>
                </div>
              );
            })}
          </div>
          {unspent > 0 && s.status === "current" && (
            <p className="mt-2 text-xs text-ink-3">
              <span className="num font-medium text-ink-2">{fmtMoney(unspent, { whole: true })}</span> of income not yet spent or saved
            </p>
          )}
          {s.businessSpent > 0 && (
            <p className="mt-1 text-xs text-ink-3">
              Business spending <span className="num font-medium text-ink-2">{fmtMoney(s.businessSpent, { whole: true })}</span> is tracked separately and not part of this check.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-3">Log income or set planned income in Settings to see how your spending splits.</p>
      )}
    </section>
  );
}
