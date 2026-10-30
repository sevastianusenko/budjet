"use client";

import { Plus } from "lucide-react";
import type { CategoryDetail } from "@/lib/details";
import { dateLabel, monthLabel } from "@/lib/dates";
import { fmtMoney, fmtPct } from "@/lib/money";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Bar, MemberDot, Pill } from "@/components/ui/Bits";
import { useAddSheet } from "@/components/shell/AppShell";

const GROUP_LABEL: Record<CategoryDetail["group"], string> = {
  need: "Need",
  want: "Want",
  savings: "Savings",
  income: "Income",
  business: "Business",
};

/** Tap a category anywhere → the breakdown by subcategory and this month's entries. */
export function CategoryDetailSheet({ detail, onClose, today }: { detail: CategoryDetail | null; onClose: () => void; today: string }) {
  const { openNew, openEdit } = useAddSheet();
  if (!detail) return null;
  const d = detail;
  const tone = d.pace === "over" ? "over" : d.pace === "ahead" ? "warn" : "green";
  const hasSubs = d.breakdown.some((r) => r.subcategoryId !== null);

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Icon name={d.icon} size={20} className="text-ink-2" />
          {d.name}
        </span>
      }
      footer={
        <Button
          className="w-full"
          onClick={() => {
            onClose();
            openNew({ type: "expense", categoryId: d.id });
          }}
        >
          <Plus size={18} /> Add to {d.name}
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        <section>
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-ink-3">
              {monthLabel(d.month)} · <Pill>{GROUP_LABEL[d.group]}</Pill>
              {d.isFixed && <Pill>fixed</Pill>}
            </p>
            {d.avg3 > 0 && <p className="num text-xs text-ink-3">usually {fmtMoney(d.avg3, { whole: true })}/mo</p>}
          </div>
          <p className="display mt-1 text-3xl font-semibold tracking-tight">
            {fmtMoney(d.spent, { whole: true })}
            {d.available > 0 && <span className="text-lg font-medium text-ink-3"> / {fmtMoney(d.available, { whole: true })}</span>}
          </p>
          <div className="mt-2">
            <Bar value={d.spent} max={d.available} tone={tone} />
          </div>
          <p className={`mt-1.5 text-sm ${d.remaining < 0 ? "font-semibold text-over" : "text-ink-2"}`}>
            {d.available > 0
              ? d.remaining < 0
                ? `Over plan by ${fmtMoney(-d.remaining, { whole: true })}`
                : `${fmtMoney(d.remaining, { whole: true })} left of the plan`
              : "No planned amount this month"}
            {d.carry > 0 && <span className="text-ink-3"> · includes {fmtMoney(d.carry, { whole: true })} carried over</span>}
          </p>
        </section>

        {d.breakdown.length > 0 && (
          <section>
            <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">{hasSubs ? "By subcategory" : "Breakdown"}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                  <th className="pb-1.5 font-semibold">Subcategory</th>
                  <th className="pb-1.5 text-right font-semibold">This month</th>
                  <th className="pb-1.5 text-right font-semibold">Avg 3 mo</th>
                  <th className="pb-1.5 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.breakdown.map((r) => (
                  <tr key={r.subcategoryId ?? "none"}>
                    <td className="py-2 pr-2">
                      <span className={r.subcategoryId === null ? "text-ink-3" : "text-ink"}>{r.name}</span>
                      <span className="mt-1 block h-1 w-full max-w-24 overflow-hidden rounded-full bg-card-2">
                        <span className="block h-full rounded-full bg-green" style={{ width: `${Math.round(r.share * 100)}%` }} />
                      </span>
                    </td>
                    <td className="num py-2 text-right font-semibold">{r.spent ? fmtMoney(r.spent, { whole: true }) : <span className="font-normal text-ink-3">—</span>}</td>
                    <td className="num py-2 text-right text-ink-2">{r.avg3 ? fmtMoney(r.avg3, { whole: true }) : <span className="text-ink-3">—</span>}</td>
                    <td className="num py-2 text-right text-ink-3">{r.spent ? fmtPct(r.share) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong">
                  <td className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Total</td>
                  <td className="num pt-2 text-right font-semibold">{fmtMoney(d.spent, { whole: true })}</td>
                  <td className="num pt-2 text-right text-ink-2">{d.avg3 ? fmtMoney(d.avg3, { whole: true }) : "—"}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            {!hasSubs && <p className="mt-2 text-xs text-ink-3">Add subcategories in Settings → Categories to split this further (by car, by child, by card…).</p>}
          </section>
        )}

        <section>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">Entries · {d.entries.length}</h3>
          {d.entries.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing logged here this month.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {d.entries.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openEdit({
                        id: e.id,
                        type: e.type,
                        amountCents: e.amountCents,
                        date: e.date,
                        categoryId: e.categoryId,
                        subcategoryId: e.subcategoryId,
                        goalId: e.goalId,
                        note: e.note,
                        userId: e.userId,
                      });
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-card-2/60"
                  >
                    <MemberDot color={e.memberColor} name={e.memberName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]">{e.subName ?? d.name}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {dateLabel(e.date, today)}
                        {e.note ? ` · ${e.note}` : ""}
                      </span>
                    </span>
                    <span className="num text-[14px] font-semibold">{fmtMoney(e.amountCents)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  );
}
