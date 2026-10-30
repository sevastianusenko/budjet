"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { GoalLite } from "@/lib/calc";
import { monthLabel } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Bar, Empty, Money, Pill } from "@/components/ui/Bits";
import { Explain } from "@/components/ui/Explain";
import { useAddSheet } from "@/components/shell/AppShell";
import { GoalSheet } from "./GoalSheet";
import { TitheFundCard } from "@/components/home/TitheFundCard";
import type { TitheStats } from "@/lib/tithe-stats";

export interface GoalItem {
  goal: GoalLite;
  saved: number;
  remaining: number;
  progress: number;
  contributedThisMonth: number;
  monthsToDeadline: number | null;
  monthlyNeeded: number | null;
  avgContribution: number;
  etaMonth: string | null;
  done: boolean;
  emergencyMonths: number | null;
}

export function GoalsScreen({
  items,
  plannedThisMonth,
  contributedThisMonth,
  monthlyNeeds,
  today,
  tithe,
}: {
  items: GoalItem[];
  plannedThisMonth: number;
  contributedThisMonth: number;
  monthlyNeeds: number;
  today: string;
  tithe: {
    stats: TitheStats;
    goal: GoalLite;
    pct: number;
    church: { categoryId?: string; subcategoryId?: string };
    help: { categoryId?: string; subcategoryId?: string };
  } | null;
}) {
  const { openNew } = useAddSheet();
  const [editing, setEditing] = useState<GoalLite | null | "new">(null);
  const active = items.filter((i) => !i.goal.archived);
  const archived = items.filter((i) => i.goal.archived);
  const totalSaved = active.reduce((a, i) => a + i.saved, 0);
  const totalTarget = active.reduce((a, i) => a + i.goal.targetCents, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="display text-2xl font-semibold tracking-tight">Goals</h1>
        <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
          <Plus size={16} /> New goal
        </Button>
      </div>

      <section className="rounded-card bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Saved toward goals</p>
          <Explain title="Goals">
            <p>Saved = starting amount + every &quot;To goal&quot; entry (withdrawals subtract). Progress is saved ÷ target.</p>
            <p>&quot;Needs per month&quot; divides what&apos;s left by the months until the deadline. ETA uses your average contribution over the last few months, or the monthly plan if you&apos;re just starting.</p>
            <p>The Emergency Fund shows how many months of essential (needs) spending it covers, based on your 3-month average.</p>
          </Explain>
        </div>
        <p className="display mt-1 text-4xl font-semibold tracking-tight">
          <Money cents={totalSaved} whole plain />
          {totalTarget > 0 && <span className="ml-2 text-lg font-medium text-ink-3">of {fmtMoney(totalTarget, { whole: true, compact: true })}</span>}
        </p>
        <div className="mt-3">
          <Bar value={totalSaved} max={totalTarget} tone="save" />
        </div>
        <p className="mt-3 text-sm text-ink-2">
          This month: <span className="num font-semibold text-ink">{fmtMoney(contributedThisMonth, { whole: true })}</span>
          {plannedThisMonth > 0 && (
            <>
              {" "}of <span className="num">{fmtMoney(plannedThisMonth, { whole: true })}</span> planned
              {contributedThisMonth >= plannedThisMonth ? <Pill tone="green">done</Pill> : null}
            </>
          )}
        </p>
      </section>

      {tithe && (
        <div className="space-y-2">
          <TitheFundCard stats={tithe.stats} tithePct={tithe.pct} churchDefaults={tithe.church} helpDefaults={tithe.help} />
          <div className="flex items-center justify-between px-1 text-xs text-ink-3">
            <span>
              Given this year: <span className="num font-medium text-ink-2">{fmtMoney(tithe.stats.givenYear, { whole: true })}</span>
              {tithe.stats.byLabelYear.length > 0 && <> · {tithe.stats.byLabelYear.map((r) => `${r.label} ${fmtMoney(r.cents, { whole: true })}`).join(", ")}</>}
            </span>
            <button type="button" onClick={() => setEditing(tithe.goal)} className="shrink-0 font-medium text-green-text">
              Adjust balance
            </button>
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <Empty
          title="No goals yet"
          body="Start with an emergency fund: three months of essential spending is the cushion most planners recommend."
          action={<Button onClick={() => setEditing("new")}>Create a goal</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {active.map((i) => (
            <GoalCard key={i.goal.id} item={i} monthlyNeeds={monthlyNeeds} onEdit={() => setEditing(i.goal)} onAdd={() => openNew({ type: "goal", goalId: i.goal.id })} />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <details className="px-1 text-sm text-ink-3">
          <summary className="cursor-pointer py-2 font-medium">Archived ({archived.length})</summary>
          <ul className="mt-2 space-y-2">
            {archived.map((i) => (
              <li key={i.goal.id}>
                <button type="button" onClick={() => setEditing(i.goal)} className="flex w-full items-center gap-3 rounded-card bg-card px-4 py-3 text-left shadow-card">
                  <Icon name={i.goal.icon} size={18} className="text-ink-3" />
                  <span className="flex-1 text-ink-2">{i.goal.name}</span>
                  <span className="num text-ink-2">{fmtMoney(i.saved, { whole: true })}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <GoalSheet open={editing !== null} onClose={() => setEditing(null)} goal={editing === "new" ? null : editing} today={today} monthlyNeeds={monthlyNeeds} />
    </div>
  );
}

function GoalCard({ item: i, monthlyNeeds, onEdit, onAdd }: { item: GoalItem; monthlyNeeds: number; onEdit: () => void; onAdd: () => void }) {
  const g = i.goal;
  let status: string;
  if (i.done) status = "Funded";
  else if (g.deadline && i.monthlyNeeded !== null)
    status = `${fmtMoney(i.monthlyNeeded, { whole: true })}/mo to finish by ${monthLabel(g.deadline.slice(0, 7), "short")} ${g.deadline.slice(0, 4)}`;
  else if (i.etaMonth) status = `At this pace, done ${monthLabel(i.etaMonth)}`;
  else status = g.monthlyPlanCents > 0 ? `Plan: ${fmtMoney(g.monthlyPlanCents, { whole: true })}/mo` : "Set a monthly plan to see an ETA";

  const behind = g.deadline && i.monthlyNeeded !== null && g.monthlyPlanCents > 0 && i.monthlyNeeded > g.monthlyPlanCents * 1.1;

  return (
    <li className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onEdit} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card-2 text-save" aria-label={`Edit ${g.name}`}>
          <Icon name={g.icon} size={22} />
        </button>
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-[16px] font-semibold">{g.name}</h3>
            <span className="num shrink-0 text-sm text-ink-2">
              <span className="font-semibold text-ink">{fmtMoney(i.saved, { whole: true })}</span> / {fmtMoney(g.targetCents, { whole: true })}
            </span>
          </div>
          <div className="mt-2">
            <Bar value={i.saved} max={g.targetCents} tone={i.done ? "green" : "save"} />
          </div>
          <p className={`mt-2 text-xs ${behind ? "text-warn" : "text-ink-3"}`}>{status}</p>
          {g.isEmergency && i.emergencyMonths !== null && (
            <p className="mt-1 text-xs text-ink-2">
              Covers <span className="num font-semibold">{i.emergencyMonths.toFixed(1)}</span> months of essentials
              {monthlyNeeds > 0 && <span className="text-ink-3"> · ~{fmtMoney(monthlyNeeds, { whole: true })}/mo</span>}
              {i.emergencyMonths >= 3 ? <Pill tone="green">3+ months</Pill> : <Pill tone="warn">aim for 3–6</Pill>}
            </p>
          )}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-ink-3">
          {i.contributedThisMonth > 0 ? `+${fmtMoney(i.contributedThisMonth, { whole: true })} this month` : g.monthlyPlanCents > 0 ? `${fmtMoney(g.monthlyPlanCents, { whole: true })} planned this month` : ""}
        </span>
        <Button size="sm" variant={i.done ? "secondary" : "primary"} onClick={onAdd}>
          <Plus size={16} /> Add money
        </Button>
      </div>
    </li>
  );
}
