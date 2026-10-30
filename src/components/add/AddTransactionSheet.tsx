"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Camera, Check, ChevronDown, Delete } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MemberDot } from "@/components/ui/Bits";
import { ErrorText, Toggle, inputClass } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { addTransaction, deleteTransaction, restoreTransaction, updateTransaction } from "@/actions/transactions";
import { addDays, dateLabel } from "@/lib/dates";
import { centsToInput, fmtMoney } from "@/lib/money";
import type { ShellCategory, ShellGoal, ShellMember, ShellSubcategory, ShellTitheFund } from "@/components/shell/AppShell";

export type EntryType = "expense" | "income" | "goal";

export interface SheetDefaults {
  type?: EntryType;
  categoryId?: string;
  subcategoryId?: string;
  goalId?: string;
  date?: string;
  /** Pre-select "paid from the Tithe fund". */
  fromFund?: boolean;
}

export interface EditableTx {
  id: string;
  type: EntryType;
  amountCents: number;
  date: string;
  categoryId: string | null;
  subcategoryId: string | null;
  goalId: string | null;
  note: string;
  userId: string;
}

interface FormProps {
  onClose: () => void;
  me: ShellMember;
  members: ShellMember[];
  categories: ShellCategory[];
  subcategories: ShellSubcategory[];
  goals: ShellGoal[];
  titheFund: ShellTitheFund | null;
  tithePct: number;
  today: string;
  defaults?: SheetDefaults;
  edit?: EditableTx;
}

/** The form mounts fresh every time the sheet opens, so its state always starts from the current props. */
export function AddTransactionSheet({ open, ...props }: FormProps & { open: boolean }) {
  if (!open) return null;
  return <EntryForm {...props} />;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"] as const;

const GROUPS: { key: ShellCategory["group"]; label: string; dot: string }[] = [
  { key: "need", label: "Needs", dot: "bg-need" },
  { key: "want", label: "Wants", dot: "bg-want" },
  { key: "savings", label: "Savings", dot: "bg-save" },
  { key: "business", label: "Business", dot: "bg-ink-3" },
];

type Picker = "category" | "sub" | null;

function EntryForm({ onClose, me, members, categories, subcategories, goals, titheFund, tithePct, today, defaults, edit }: FormProps) {
  const toast = useToast();
  const [pending, start] = useTransition();
  // A giving entry paid out of the Tithe fund is stored as a fund withdrawal with a category; edit it as an expense.
  const editIsFundGiving = Boolean(edit && titheFund && edit.type === "goal" && edit.goalId === titheFund.id && edit.amountCents < 0 && edit.categoryId);
  const [type, setType] = useState<EntryType>(editIsFundGiving ? "expense" : edit?.type ?? defaults?.type ?? "expense");
  const [amount, setAmount] = useState(edit ? centsToInput(Math.abs(edit.amountCents)) : "");
  const [withdraw, setWithdraw] = useState(edit ? edit.type === "goal" && edit.amountCents < 0 && !editIsFundGiving : false);
  const [categoryId, setCategoryId] = useState<string | null>(edit ? edit.categoryId : defaults?.categoryId ?? null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(edit ? edit.subcategoryId : defaults?.subcategoryId ?? null);
  const [goalId, setGoalId] = useState<string | null>(edit ? (editIsFundGiving ? null : edit.goalId) : defaults?.goalId ?? null);
  const [date, setDate] = useState(edit?.date ?? defaults?.date ?? today);
  const [note, setNote] = useState(edit?.note ?? "");
  const [paidBy, setPaidBy] = useState(edit?.userId ?? me.id);
  const [error, setError] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(Boolean(edit?.note));
  const [fromFund, setFromFund] = useState<boolean>(() => {
    if (!titheFund) return false;
    if (edit) return editIsFundGiving;
    if (defaults?.fromFund !== undefined) return defaults.fromFund;
    return categories.find((c) => c.id === defaults?.categoryId)?.name === "Tithe";
  });

  const subsFor = (catId: string | null) =>
    subcategories.filter((s) => s.categoryId === catId && (!s.archived || s.id === subcategoryId)).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));

  // Picking is the first step for a new entry; it collapses once something is chosen.
  const [picker, setPicker] = useState<Picker>(() => {
    if (edit) return null;
    if (type === "goal") return goalId ? null : "category";
    if (!categoryId) return "category";
    if (!subcategoryId && subsFor(categoryId).some((s) => !s.archived)) return "sub";
    return null;
  });

  const kind = type === "income" ? "income" : "expense";
  const cats = useMemo(
    () => categories.filter((c) => c.kind === kind && (!c.archived || c.id === categoryId)).sort((a, b) => b.uses - a.uses),
    [categories, kind, categoryId],
  );
  const activeGoals = goals.filter((g) => !g.isTithe && (!g.archived || g.id === goalId));
  const selectedCat = cats.find((c) => c.id === categoryId) ?? null;
  const selectedSub = subcategories.find((s) => s.id === subcategoryId) ?? null;
  const selectedGoal = activeGoals.find((g) => g.id === goalId) ?? null;
  const subs = subsFor(categoryId);

  const cents = Math.round(Number(amount || "0") * 100);

  function switchType(t: EntryType) {
    setType(t);
    setError(null);
    if (t === "goal") {
      const g = goalId ?? activeGoals.find((x) => !x.archived)?.id ?? null;
      setGoalId(g);
      setPicker(!g || activeGoals.length > 1 ? "category" : null);
    } else {
      setCategoryId(null);
      setSubcategoryId(null);
      setFromFund(false);
      setPicker("category");
    }
  }

  function pickCategory(id: string) {
    setCategoryId(id);
    setSubcategoryId(null);
    setError(null);
    if (titheFund && type === "expense" && !edit) setFromFund(categories.find((c) => c.id === id)?.name === "Tithe");
    setPicker(subsFor(id).some((s) => !s.archived) ? "sub" : null);
  }

  function press(k: (typeof KEYS)[number]) {
    setError(null);
    setAmount((a) => {
      if (k === "⌫") return a.slice(0, -1);
      if (k === ".") return a.includes(".") ? a : a === "" ? "0." : a + ".";
      const [, dec] = a.split(".");
      if (dec !== undefined && dec.length >= 2) return a;
      if (a === "0") return k;
      if (a.replace(".", "").length >= 9) return a;
      return a + k;
    });
  }

  function submit() {
    if (type !== "goal" && !categoryId) {
      setPicker("category");
      return setError("Pick a category.");
    }
    if (type === "goal" && !goalId) {
      setPicker("category");
      return setError("Pick a goal.");
    }
    if (!cents) return setError("Enter an amount.");
    const giving = type === "expense" && fromFund && titheFund;
    const payload = giving
      ? { type: "goal" as const, amountCents: -cents, date, categoryId, subcategoryId, goalId: titheFund.id, note, userId: paidBy }
      : {
          type,
          amountCents: type === "goal" && withdraw ? -cents : cents,
          date,
          categoryId: type === "goal" ? null : categoryId,
          subcategoryId: type === "goal" ? null : subcategoryId,
          goalId: type === "goal" ? goalId : null,
          note,
          userId: paidBy,
        };
    start(async () => {
      const res = edit ? await updateTransaction(edit.id, payload) : await addTransaction(payload);
      if (!res.ok) return setError(res.error);
      onClose();
      const label = giving
        ? "Given from the Tithe fund"
        : type === "income"
          ? "Income added"
          : type === "goal"
            ? withdraw
              ? "Withdrawal saved"
              : "Saved to goal"
            : "Expense added";
      const extra = !edit && type === "income" && res.setAside ? ` · ${fmtMoney(res.setAside, { whole: true })} set aside for tithe` : "";
      toast({
        message: edit ? "Entry updated" : `${label} · ${fmtMoney(cents)}${extra}`,
        action: edit
          ? undefined
          : {
              label: "Undo",
              onClick: async () => {
                await deleteTransaction(res.id);
              },
            },
      });
    });
  }

  function remove() {
    if (!edit) return;
    start(async () => {
      const res = await deleteTransaction(edit.id);
      if (!res.ok) return setError(res.error);
      onClose();
      toast({
        message: "Entry deleted",
        action: { label: "Undo", onClick: async () => void (await restoreTransaction(res.deleted)) },
      });
    });
  }

  const typeTabs: { id: EntryType; label: string }[] = [
    { id: "expense", label: "Expense" },
    { id: "income", label: "Income" },
    { id: "goal", label: "To goal" },
  ];

  const amountColor = type === "income" ? "text-green-text" : type === "goal" ? "text-save" : "text-ink";
  const chosenIcon = type === "goal" ? selectedGoal?.icon : selectedCat?.icon;
  const chosenLabel =
    type === "goal"
      ? selectedGoal?.name ?? "Choose a goal"
      : selectedCat
        ? selectedSub
          ? `${selectedCat.name} · ${selectedSub.name}`
          : selectedCat.name
        : "Choose a category";
  const fundShort = titheFund ? titheFund.balance - (edit && editIsFundGiving ? 0 : 0) : 0;

  return (
    <Sheet
      open
      onClose={onClose}
      footer={
        picker ? undefined : (
          <div className="flex gap-2">
            {edit && (
              <Button variant="danger" onClick={remove} disabled={pending} aria-label="Delete entry">
                Delete
              </Button>
            )}
            <Button className="flex-1" size="lg" onClick={submit} disabled={pending}>
              <Check size={20} />
              {edit ? "Save changes" : type === "expense" && fromFund && titheFund ? "Give from fund" : type === "goal" ? (withdraw ? "Withdraw" : "Add to goal") : "Save"}
            </Button>
          </div>
        )
      }
    >
      <div className="pt-1">
        <div role="tablist" className="mx-auto grid max-w-xs grid-cols-3 rounded-2xl bg-card-2 p-1">
          {typeTabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={type === t.id}
              type="button"
              onClick={() => switchType(t.id)}
              className={`h-9 rounded-xl text-sm font-medium transition-colors ${
                type === t.id ? "bg-card text-ink shadow-sm" : "text-ink-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {picker === "category" ? (
          <div className="pb-2 pt-4">
            <p className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-3">
              {type === "goal" ? "Which goal?" : type === "income" ? "What kind of income?" : "What was it for?"}
            </p>
            {type === "goal" ? (
              activeGoals.length === 0 ? (
                <p className="text-sm text-ink-3">No goals yet. Create one on the Goals tab.</p>
              ) : (
                <Grid
                  items={activeGoals.map((g) => ({ id: g.id, name: g.name, icon: g.icon, tint: "text-save" }))}
                  selectedId={goalId}
                  onPick={(id) => {
                    setGoalId(id);
                    setPicker(null);
                    setError(null);
                  }}
                />
              )
            ) : type === "income" ? (
              <Grid items={cats.map((c) => ({ id: c.id, name: c.name, icon: c.icon, tint: "text-green-text" }))} selectedId={categoryId} onPick={pickCategory} />
            ) : (
              <div className="space-y-4">
                {GROUPS.map((g) => {
                  const items = cats.filter((c) => c.group === g.key);
                  if (items.length === 0) return null;
                  return (
                    <div key={g.key}>
                      <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-ink-2">
                        <span className={`h-2 w-2 rounded-full ${g.dot}`} />
                        {g.label}
                      </p>
                      <Grid items={items.map((c) => ({ id: c.id, name: c.name, icon: c.icon, tint: "text-ink-2" }))} selectedId={categoryId} onPick={pickCategory} />
                    </div>
                  );
                })}
                {cats.length === 0 && <p className="text-sm text-ink-3">No categories yet. Add some in Settings.</p>}
              </div>
            )}
            {type === "expense" && !edit && (
              <Link href="/import" onClick={onClose} className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-3 text-sm font-medium text-ink-2 hover:bg-card-2">
                <Camera size={16} /> Have a receipt? Scan or paste it
              </Link>
            )}
            <div className="mt-3">
              <ErrorText>{error}</ErrorText>
            </div>
          </div>
        ) : picker === "sub" && selectedCat ? (
          <div className="pb-2 pt-4">
            <button type="button" onClick={() => setPicker("category")} className="mb-3 flex items-center gap-2 px-1 text-[13px] font-semibold text-ink-2">
              <Icon name={selectedCat.icon} size={16} className="text-ink-3" />
              {selectedCat.name}
              <span className="font-normal text-ink-3">· change</span>
            </button>
            <p className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-3">Which kind?</p>
            <div className="flex flex-wrap gap-2">
              <SubChip
                active={subcategoryId === null}
                label={`Just ${selectedCat.name}`}
                muted
                onClick={() => {
                  setSubcategoryId(null);
                  setPicker(null);
                }}
              />
              {subs.map((s) => (
                <SubChip
                  key={s.id}
                  active={subcategoryId === s.id}
                  label={s.name}
                  onClick={() => {
                    setSubcategoryId(s.id);
                    setPicker(null);
                    setError(null);
                  }}
                />
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-3">Add or rename these in Settings → Categories → {selectedCat.name}.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center pb-3 pt-4">
              <div className={`display flex items-baseline text-5xl font-semibold ${amountColor}`}>
                <span className="mr-1 text-3xl text-ink-3">{type === "goal" && withdraw ? "−$" : "$"}</span>
                <span className={amount ? "" : "text-ink-3"}>{amount || "0"}</span>
              </div>
              {type === "goal" && (
                <button
                  type="button"
                  onClick={() => setWithdraw((w) => !w)}
                  className="mt-2 text-xs font-medium text-ink-3 underline-offset-2 hover:underline"
                >
                  {withdraw ? "Switch to adding money" : "Taking money out instead?"}
                </button>
              )}
              {type === "income" && tithePct > 0 && titheFund && cents > 0 && (
                <p className="mt-2 text-xs text-ink-3">
                  {tithePct}% · {fmtMoney(Math.round((cents * tithePct) / 100))} goes to the Tithe fund automatically
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPicker("category")}
                className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line bg-card px-3 text-left hover:border-line-strong"
                aria-label={`${chosenLabel}. Tap to change`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-soft text-green-text">
                  <Icon name={chosenIcon ?? "Tag"} size={18} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{chosenLabel}</span>
                <ChevronDown size={18} className="shrink-0 text-ink-3" />
              </button>
              {type !== "goal" && selectedCat && subs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPicker("sub")}
                  className="flex h-12 shrink-0 items-center rounded-2xl border border-line bg-card px-3 text-sm font-medium text-ink-2 hover:border-line-strong"
                >
                  {selectedSub ? "Kind" : "+ Kind"}
                </button>
              )}
            </div>

            {type === "expense" && titheFund && (
              <div className="mt-2 rounded-2xl border border-line px-4">
                <Toggle
                  checked={fromFund}
                  onChange={setFromFund}
                  label="Paid from the Tithe fund"
                  description={
                    fromFund
                      ? `Fund has ${fmtMoney(fundShort, { whole: true })}. This won't count as new spending.`
                      : "Off = paid from our own money (counts as spending)."
                  }
                />
              </div>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  aria-label={k === "⌫" ? "Delete digit" : k}
                  className="display flex h-13 items-center justify-center rounded-2xl bg-card-2 text-2xl font-medium text-ink active:bg-line"
                >
                  {k === "⌫" ? <Delete size={22} /> : k}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <DateQuick value={date} today={today} onChange={setDate} />
              {members.length > 1 && (
                <div className="flex items-center gap-1 rounded-xl bg-card-2 p-1" role="radiogroup" aria-label="Paid by">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={paidBy === m.id}
                      title={m.name}
                      onClick={() => setPaidBy(m.id)}
                      className={`rounded-lg p-1 transition-opacity ${paidBy === m.id ? "bg-card opacity-100 shadow-sm" : "opacity-40"}`}
                    >
                      <MemberDot color={m.color} name={m.name} size="md" />
                    </button>
                  ))}
                </div>
              )}
              {!showNote && (
                <button type="button" onClick={() => setShowNote(true)} className="h-9 rounded-xl px-3 text-sm text-ink-2 hover:bg-card-2">
                  + Note
                </button>
              )}
            </div>
            {showNote && (
              <input
                autoFocus={!edit}
                className={`${inputClass} mt-2`}
                placeholder="Note (optional)"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
            <div className="mt-3">
              <ErrorText>{error}</ErrorText>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Four-up grid of icon tiles with names, all visible at once. */
function Grid({
  items,
  selectedId,
  onPick,
}: {
  items: { id: string; name: string; icon: string; tint: string }[];
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-3">
      {items.map((it) => {
        const active = it.id === selectedId;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onPick(it.id)}
            aria-pressed={active}
            className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-1 text-center active:bg-card-2"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
                active ? "bg-green text-green-ink ring-2 ring-green ring-offset-2 ring-offset-card" : `bg-card-2 ${it.tint}`
              }`}
            >
              <Icon name={it.icon} size={22} />
            </span>
            <span className={`line-clamp-2 w-full text-[11px] leading-tight ${active ? "font-semibold text-ink" : "text-ink-2"}`}>{it.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function SubChip({ active, label, onClick, muted = false }: { active: boolean; label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-11 rounded-2xl border px-4 text-[15px] font-medium transition-colors ${
        active ? "border-green bg-green-soft text-green-text" : muted ? "border-dashed border-line-strong text-ink-3" : "border-line bg-card text-ink hover:border-line-strong"
      }`}
    >
      {label}
    </button>
  );
}

function DateQuick({ value, today, onChange }: { value: string; today: string; onChange: (d: string) => void }) {
  const yesterday = addDays(today, -1);
  const custom = value !== today && value !== yesterday;
  return (
    <div className="flex items-center gap-1 rounded-xl bg-card-2 p-1">
      {[today, yesterday].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`h-8 rounded-lg px-2.5 text-sm font-medium ${value === d ? "bg-card text-ink shadow-sm" : "text-ink-2"}`}
        >
          {dateLabel(d, today)}
        </button>
      ))}
      <label className={`relative flex h-8 items-center rounded-lg px-2.5 text-sm font-medium ${custom ? "bg-card text-ink shadow-sm" : "text-ink-2"}`}>
        {custom ? dateLabel(value, today) : "Other"}
        <input
          type="date"
          aria-label="Pick a date"
          className="absolute inset-0 opacity-0"
          value={value}
          max={addDays(today, 365)}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
