import Link from "next/link";
import type { MonthSummary } from "@/lib/calc";
import { fmtMoney } from "@/lib/money";
import { Bar, Money } from "@/components/ui/Bits";
import { Explain } from "@/components/ui/Explain";

export function SafeToSpendCard({ summary: s }: { summary: MonthSummary }) {
  const planned = s.plannedExpenses + s.plannedSavingsCategories;
  const negative = s.safeToSpend < 0;
  const past = s.status === "past";
  const future = s.status === "future";

  const label = past ? "Left over" : future ? "Planned to spend" : "Safe to spend";
  const hero = past ? s.income - s.spent - s.goalContributions : future ? planned : s.safeToSpend;

  const sub = past
    ? `${fmtMoney(s.income, { whole: true })} in · ${fmtMoney(s.spent, { whole: true })} out · ${fmtMoney(s.goalContributions, { whole: true })} to goals`
    : future
      ? `${fmtMoney(s.plannedGoals, { whole: true })} planned for goals`
      : negative
        ? `Over by ${fmtMoney(-s.safeToSpend, { whole: true })} · ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left`
        : `${fmtMoney(s.safeToSpendPerDay, { whole: true })} a day for ${s.daysLeft} more day${s.daysLeft === 1 ? "" : "s"}`;

  const explanation =
    s.mode === "plan"
      ? [
          "Safe to spend = what's left in your variable categories (planned + rollover − spent),",
          "minus any overspend in fixed bills and savings,",
          s.unassigned !== null && s.unassigned < 0 ? "minus the amount your plans exceed income." : "",
          "Per day divides that by the days left in the month, including today.",
        ]
          .filter(Boolean)
          .join(" ")
      : "Without a plan this month, Safe to spend = income − spending − goal contributions. Set planned amounts on the Plan tab for a smarter number.";

  const progressMax = s.mode === "plan" ? planned : Math.max(s.income, s.spent);
  const tone = s.spent > progressMax && progressMax > 0 ? "over" : s.projectedSpend > progressMax && progressMax > 0 ? "warn" : "green";

  return (
    <section className="rounded-card bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{label}</p>
        <Explain title={label}>{explanation}</Explain>
      </div>
      <p className={`display mt-1 text-[56px] font-semibold leading-none tracking-tight ${negative ? "text-over" : "text-ink"}`}>
        <Money cents={hero} whole plain />
      </p>
      <p className="mt-2 text-[15px] text-ink-2">{sub}</p>

      {!future && (
        <div className="mt-4">
          <Bar value={s.spent} max={progressMax} tone={tone} marker={s.status === "current" && s.mode === "plan" ? s.dayOfMonth / s.daysInMonth : null} />
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>
              Spent <Money cents={s.spent} whole className="text-ink-2" />
              {s.mode === "plan" ? (
                <>
                  {" "}of <Money cents={planned} whole className="text-ink-2" />
                </>
              ) : (
                <>
                  {" "}· Income <Money cents={s.income} whole className="text-ink-2" />
                </>
              )}
            </span>
            {s.status === "current" && s.mode === "plan" && (
              <span>
                Projected <Money cents={s.projectedSpend} whole className={s.projectedSpend > planned ? "text-over" : "text-ink-2"} />
              </span>
            )}
            {s.mode === "cashflow" && s.status === "current" && (
              <Link href="/plan" className="font-medium text-green-text underline-offset-2 hover:underline">
                Set a plan
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
