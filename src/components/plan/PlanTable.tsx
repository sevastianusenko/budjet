"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Copy, Sparkles } from "lucide-react";
import { applyStarterPlan, copyLastMonth, setPlanned } from "@/actions/budgets";
import { fmtMoney, fmtPct, parseAmountToCents } from "@/lib/money";
import type { CategoryDetail } from "@/lib/details";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Bar, Money, Pill } from "@/components/ui/Bits";
import { Explain } from "@/components/ui/Explain";
import { Sheet } from "@/components/ui/Sheet";
import { ErrorText, Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { CategoryDetailSheet } from "./CategoryDetailSheet";

type PlanGroup = "need" | "want" | "savings" | "business";

const GROUPS: { key: PlanGroup; label: string; targetKey: "needs" | "wants" | "savings" | null; dot: string }[] = [
  { key: "need", label: "Needs", targetKey: "needs", dot: "bg-need" },
  { key: "want", label: "Wants", targetKey: "wants", dot: "bg-want" },
  { key: "savings", label: "Savings", targetKey: "savings", dot: "bg-save" },
  { key: "business", label: "Business", targetKey: null, dot: "bg-ink-3" },
];

export function PlanTable(props: {
  month: string;
  status: "past" | "current" | "future";
  dayOfMonth: number;
  daysInMonth: number;
  today: string;
  expectedIncome: number;
  actualIncome: number;
  targets: { needs: number; wants: number; savings: number };
  details: CategoryDetail[];
  goals: { id: string; name: string; icon: string; monthlyPlanCents: number }[];
  goalContributions: number;
  plannedTithe: number;
  titheSetAside: number;
  tithePct: number;
  prevHasPlan: boolean;
}) {
  const { month, status, targets } = props;
  const toast = useToast();
  const [pending, start] = useTransition();
  const [planned, setPlannedLocal] = useState<Record<string, number>>({});
  const [starterOpen, setStarterOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Optimistic planned amounts; cleared when fresh server data arrives.
  const [seen, setSeen] = useState(props.details);
  if (seen !== props.details) {
    setSeen(props.details);
    setPlannedLocal({});
  }
  const rows = useMemo(
    () => props.details.map((d) => (planned[d.id] !== undefined ? { ...d, planned: planned[d.id], available: planned[d.id] + d.carry, remaining: planned[d.id] + d.carry - d.spent } : d)),
    [props.details, planned],
  );

  const incomeRef = props.expectedIncome > 0 ? props.expectedIncome : props.actualIncome;
  const plannedTotal = rows.reduce((a, r) => a + r.planned, 0);
  const goalsPlanned = props.goals.reduce((a, g) => a + g.monthlyPlanCents, 0);
  const unassigned = incomeRef - plannedTotal - goalsPlanned - props.plannedTithe;
  const hasPlan = plannedTotal > 0;
  const marker = status === "current" ? props.dayOfMonth / props.daysInMonth : null;

  function save(id: string, cents: number) {
    setPlannedLocal((p) => ({ ...p, [id]: cents }));
    start(async () => {
      const res = await setPlanned({ categoryId: id, month, plannedCents: cents });
      if (!res.ok) {
        setPlannedLocal((p) => {
          const next = { ...p };
          delete next[id];
          return next;
        });
        toast({ message: res.error, tone: "error" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-card bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">To assign</p>
          <Explain title="To assign">
            <p>Zero-based budgeting in one line: income − planned spending − planned goal contributions. The target is $0, meaning every dollar has a job.</p>
            <p>Income is your planned monthly take-home from Settings; when that&apos;s not set, it&apos;s the income logged this month.</p>
            <p>A positive number is money with no plan (it tends to disappear). A negative number means your plans promise more than you earn.</p>
          </Explain>
        </div>
        {incomeRef > 0 ? (
          <>
            <p className={`display mt-1 text-4xl font-semibold tracking-tight ${unassigned < 0 ? "text-over" : unassigned === 0 ? "text-green-text" : "text-ink"}`}>
              <Money cents={unassigned} whole plain />
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {unassigned === 0
                ? "Every dollar has a job."
                : unassigned > 0
                  ? `${fmtMoney(incomeRef, { whole: true })} income − ${fmtMoney(plannedTotal, { whole: true })} planned − ${fmtMoney(goalsPlanned, { whole: true })} to goals`
                  : `Plans exceed ${fmtMoney(incomeRef, { whole: true })} income. Trim a category or a goal.`}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-2">
            Set your planned monthly income in{" "}
            <Link href="/settings" className="font-medium text-green-text underline-offset-2 hover:underline">
              Settings
            </Link>{" "}
            to see how much is left to assign.
          </p>
        )}
        {!hasPlan && status !== "past" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {props.prevHasPlan && (
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await copyLastMonth(month);
                    toast(res.ok ? { message: "Last month's plan copied" } : { message: res.error, tone: "error" });
                  })
                }
              >
                <Copy size={16} /> Copy last month
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setStarterOpen(true)}>
              <Sparkles size={16} /> Suggested plan
            </Button>
          </div>
        )}
      </section>

      {GROUPS.map((g) => {
        // The import parking spot (Uncategorized) only shows while something is parked in it.
        const groupRows = rows.filter((r) => r.group === g.key && (r.planned > 0 || r.spent > 0 || !isArchivedLike(r)) && !(r.name === "Uncategorized" && r.spent === 0 && r.planned === 0));
        const isSavings = g.key === "savings";
        const isNeeds = g.key === "need";
        const showTithe = isNeeds && props.tithePct > 0;
        if (groupRows.length === 0 && !(isSavings && props.goals.length > 0) && !showTithe) return null;
        const groupPlanned = groupRows.reduce((a, r) => a + r.planned, 0) + (isSavings ? goalsPlanned : 0) + (showTithe ? props.plannedTithe : 0);
        const groupSpent = groupRows.reduce((a, r) => a + r.spent, 0) + (isSavings ? props.goalContributions : 0) + (showTithe ? props.titheSetAside : 0);
        const share = incomeRef > 0 ? groupPlanned / incomeRef : null;
        const target = g.targetKey ? targets[g.targetKey] / 100 : null;
        return (
          <section key={g.key}>
            <div className="mb-2 flex items-end justify-between px-1">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">
                <span className={`h-2 w-2 rounded-full ${g.dot}`} />
                {g.label}
                {share !== null && (
                  <span className={`normal-case tracking-normal ${target !== null && share > target + 0.02 && g.key !== "savings" ? "text-over" : ""}`}>
                    · {fmtPct(share)} of income {target !== null && <span className="text-ink-3">/ {fmtPct(target)}</span>}
                  </span>
                )}
              </h2>
              <span className="num text-xs text-ink-3">
                {fmtMoney(groupSpent, { whole: true })} / {fmtMoney(groupPlanned, { whole: true })}
              </span>
            </div>
            <ul className="divide-y divide-line rounded-card bg-card shadow-card">
              {showTithe && (
                <li className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-2 text-ink-2">
                    <Icon name="Church" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[15px] font-medium">Tithe fund</span>
                      <span className="num shrink-0 text-[15px]">
                        <span className="font-semibold text-ink">{fmtMoney(props.titheSetAside, { whole: true })}</span>
                        <span className="text-ink-3"> / </span>
                        <Link href="/settings" className="text-ink-2 underline decoration-dotted underline-offset-4">
                          {fmtMoney(props.plannedTithe, { whole: true })}
                        </Link>
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Bar value={props.titheSetAside} max={props.plannedTithe} tone="green" className="flex-1" />
                      <span className="num w-20 shrink-0 text-right text-xs text-ink-3">{props.tithePct}% of income</span>
                    </div>
                  </div>
                </li>
              )}
              {groupRows.map((r) => (
                <PlanRowView key={r.id} row={r} marker={marker} status={status} onSave={(c) => save(r.id, c)} onOpen={() => setDetailId(r.id)} />
              ))}
              {isSavings &&
                props.goals.map((goal) => (
                  <li key={goal.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-2 text-save">
                      <Icon name={goal.icon} size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{goal.name}</p>
                      <p className="text-xs text-ink-3">Goal · edit on the Goals tab</p>
                    </div>
                    <Link href="/goals" className="num text-[15px] font-semibold text-ink-2">
                      {fmtMoney(goal.monthlyPlanCents, { whole: true })}
                    </Link>
                  </li>
                ))}
            </ul>
            {g.key === "business" && <p className="mt-1.5 px-1 text-xs text-ink-3">Business spending is planned and tracked here but left out of the 50/30/20 check.</p>}
          </section>
        );
      })}

      <p className="px-1 text-xs text-ink-3">Tap a category for its breakdown and entries. Tap a planned amount to change it. Rollover categories carry unspent money forward.</p>

      <StarterSheet open={starterOpen} onClose={() => setStarterOpen(false)} month={month} defaultIncome={props.expectedIncome} />
      <CategoryDetailSheet detail={rows.find((r) => r.id === detailId) ?? null} onClose={() => setDetailId(null)} today={props.today} />
    </div>
  );
}

/** Rows come pre-filtered by the server (archived categories only appear with activity). */
function isArchivedLike(_r: CategoryDetail): boolean {
  void _r;
  return false;
}

function PlanRowView({
  row: r,
  marker,
  status,
  onSave,
  onOpen,
}: {
  row: CategoryDetail;
  marker: number | null;
  status: "past" | "current" | "future";
  onSave: (cents: number) => void;
  onOpen: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const tone = r.pace === "over" ? "over" : r.pace === "ahead" ? "warn" : "green";
  const subCount = r.breakdown.filter((b) => b.subcategoryId !== null && b.spent > 0).length;

  function commit() {
    setEditing(false);
    const cents = draft.trim() === "" || draft.trim() === "0" ? 0 : parseAmountToCents(draft);
    if (cents === null) return;
    if (cents !== r.planned) onSave(cents);
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button type="button" onClick={onOpen} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-2 text-ink-2" aria-label={`Details for ${r.name}`}>
        <Icon name={r.icon} size={18} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-1.5 text-left">
            <span className="truncate text-[15px] font-medium">{r.name}</span>
            {subCount > 0 && <span className="shrink-0 text-[11px] text-ink-3">{subCount} sub</span>}
            {r.carry > 0 && <Pill tone="green">+{fmtMoney(r.carry, { whole: true })}</Pill>}
            {r.isFixed && <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">fixed</span>}
          </button>
          {editing ? (
            <input
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              aria-label={`Planned amount for ${r.name}`}
              className="num h-8 w-28 rounded-lg border border-green bg-card px-2 text-right text-[15px] focus:outline-none"
            />
          ) : (
            <button
              type="button"
              disabled={status === "past"}
              onClick={() => {
                setDraft(r.planned ? (r.planned / 100).toFixed(2).replace(/\.00$/, "") : "");
                setEditing(true);
              }}
              className="num shrink-0 rounded-lg px-2 py-0.5 text-[15px] hover:bg-card-2 disabled:opacity-100"
              title="Tap to change the planned amount"
            >
              <span className="font-semibold text-ink">{fmtMoney(r.spent, { whole: true })}</span>
              <span className="text-ink-3"> / </span>
              <span className={`${r.planned ? "text-ink-2" : "text-ink-3"} underline decoration-dotted underline-offset-4`}>
                {r.planned ? fmtMoney(r.planned, { whole: true }) : "plan"}
              </span>
            </button>
          )}
        </div>
        <button type="button" onClick={onOpen} className="mt-1.5 flex w-full items-center gap-2">
          <Bar value={r.spent} max={r.available} tone={tone} marker={!r.isFixed ? marker : null} className="flex-1" />
          <span className={`num w-20 shrink-0 text-right text-xs ${r.remaining < 0 ? "font-semibold text-over" : "text-ink-3"}`}>
            {r.available > 0 || r.spent > 0
              ? r.remaining < 0
                ? `${fmtMoney(r.remaining, { whole: true })}`
                : `${fmtMoney(r.remaining, { whole: true })} left`
              : r.avg3 > 0
                ? `avg ${fmtMoney(r.avg3, { whole: true })}`
                : ""}
          </span>
        </button>
      </div>
    </li>
  );
}

function StarterSheet({ open, onClose, month, defaultIncome }: { open: boolean; onClose: () => void; month: string; defaultIncome: number }) {
  const [income, setIncome] = useState(defaultIncome ? String(defaultIncome / 100) : "");
  const [tithe, setTithe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Suggested plan"
      footer={
        <Button
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={() => {
            const cents = parseAmountToCents(income);
            if (!cents) return setError("Enter your monthly take-home income.");
            start(async () => {
              const res = await applyStarterPlan({ incomeCents: cents, month, tithe });
              if (!res.ok) return setError(res.error);
              onClose();
              toast({ message: "Suggested plan applied. Adjust anything that doesn't fit." });
            });
          }}
        >
          Apply to {month}
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <p className="text-sm text-ink-2">
          Spreads your take-home across the starter categories using the 50/30/20 rule and how a typical U.S. household spends. Overwrites planned amounts for this month only; nothing else changes.
        </p>
        <Field label="Monthly take-home income (everyone, after taxes)">
          <Input inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="6,500" className="num" />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={tithe} onChange={(e) => setTithe(e.target.checked)} className="h-5 w-5 accent-[var(--green)]" />
          We tithe 10% of income (everything else scales to 90%)
        </label>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
