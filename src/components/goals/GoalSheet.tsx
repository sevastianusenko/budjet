"use client";

import { useState, useTransition } from "react";
import { deleteGoal, saveGoal, setGoalArchived } from "@/actions/goals";
import type { GoalLite } from "@/lib/calc";
import { GOAL_ICONS } from "@/lib/defaults";
import { centsToInput, fmtMoney, parseAmountToCents } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Toggle } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

interface FormProps {
  onClose: () => void;
  goal: GoalLite | null;
  today: string;
  monthlyNeeds: number;
}

export function GoalSheet({ open, ...props }: FormProps & { open: boolean }) {
  if (!open) return null;
  return <GoalForm {...props} />;
}

function GoalForm({ onClose, goal, today, monthlyNeeds }: FormProps) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(goal?.name ?? "");
  const [icon, setIcon] = useState<string>(goal?.icon ?? "PiggyBank");
  const [target, setTarget] = useState(goal ? centsToInput(goal.targetCents) : "");
  const [monthly, setMonthly] = useState(goal ? centsToInput(goal.monthlyPlanCents) : "");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [starting, setStarting] = useState(goal ? centsToInput(goal.startingCents) : "");
  const [isEmergency, setIsEmergency] = useState(goal?.isEmergency ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const targetCents = parseAmountToCents(target) ?? 0;
  const monthlyCents = parseAmountToCents(monthly) ?? 0;
  const monthsAtPlan =
    monthlyCents > 0 && targetCents > 0 ? Math.ceil(Math.max(0, targetCents - (parseAmountToCents(starting) ?? 0)) / monthlyCents) : null;

  function submit() {
    start(async () => {
      const res = await saveGoal({
        id: goal?.id,
        name,
        icon,
        targetCents,
        monthlyPlanCents: monthlyCents,
        deadline: deadline || null,
        isEmergency,
        startingCents: parseAmountToCents(starting) ?? 0,
      });
      if (!res.ok) return setError(res.error);
      onClose();
      toast({ message: goal ? "Goal updated" : "Goal created" });
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={goal ? "Edit goal" : "New goal"}
      footer={
        <div className="flex gap-2">
          {goal && (
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                start(async () => {
                  const res = await deleteGoal(goal.id);
                  if (!res.ok) return setError(res.error);
                  onClose();
                  toast({ message: "Goal and its entries deleted" });
                });
              }}
            >
              {confirmDelete ? "Really delete?" : "Delete"}
            </Button>
          )}
          <Button className="flex-1" size="lg" onClick={submit} disabled={pending}>
            {goal ? "Save changes" : "Create goal"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2 pt-1">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund, Hawaii, New roof…" maxLength={60} />
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Icon</span>
          <div className="grid grid-cols-8 gap-1.5">
            {GOAL_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                aria-label={i}
                aria-pressed={icon === i}
                className={`flex aspect-square items-center justify-center rounded-xl ${icon === i ? "bg-green-soft text-green-text ring-2 ring-green" : "bg-card-2 text-ink-2"}`}
              >
                <Icon name={i} size={18} />
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target">
            <Input inputMode="decimal" className="num" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10,000" />
          </Field>
          <Field label="Per month (plan)">
            <Input inputMode="decimal" className="num" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="300" />
          </Field>
        </div>
        {monthsAtPlan !== null && monthsAtPlan > 0 && (
          <p className="-mt-2 text-xs text-ink-3">
            At {fmtMoney(monthlyCents, { whole: true })}/mo that&apos;s about {monthsAtPlan} month{monthsAtPlan === 1 ? "" : "s"}.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Deadline (optional)">
            <Input type="date" value={deadline} min={today} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Field label="Already saved">
            <Input inputMode="decimal" className="num" value={starting} onChange={(e) => setStarting(e.target.value)} placeholder="0" />
          </Field>
        </div>

        <Toggle
          checked={isEmergency}
          onChange={(v) => {
            setIsEmergency(v);
            if (v && !target && monthlyNeeds > 0) setTarget(centsToInput(Math.round((monthlyNeeds * 3) / 100) * 100));
          }}
          label="This is our emergency fund"
          description={monthlyNeeds > 0 ? `Shows months of essentials covered (~${fmtMoney(monthlyNeeds, { whole: true })}/mo).` : "Shows how many months of essentials it covers."}
        />

        {goal && (
          <button
            type="button"
            className="text-sm font-medium text-ink-2 underline-offset-2 hover:underline"
            onClick={() =>
              start(async () => {
                const res = await setGoalArchived(goal.id, !goal.archived);
                if (!res.ok) return setError(res.error);
                onClose();
                toast({ message: goal.archived ? "Goal restored" : "Goal archived" });
              })
            }
          >
            {goal.archived ? "Restore this goal" : "Archive this goal (keeps history)"}
          </button>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
