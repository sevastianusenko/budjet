"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { deleteBill, saveBill, type BillInput } from "@/actions/recurring";
import { shortDate } from "@/lib/dates";
import { centsToInput, fmtMoney, parseAmountToCents } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Select, Toggle } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Empty, Pill } from "@/components/ui/Bits";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { MarkPaidButton } from "@/components/bills/MarkPaidButton";

export interface BillLite {
  id: string;
  name: string;
  amountCents: number;
  dayOfMonth: number;
  categoryId: string;
  type: "expense" | "income";
  active: boolean;
}

export function BillsManager({
  month,
  items,
  inactive,
  categories,
}: {
  month: string;
  items: { bill: BillLite; due: string; paid: boolean; paidDate: string | null; daysUntil: number }[];
  inactive: BillLite[];
  categories: { id: string; name: string; icon: string; kind: "expense" | "income" }[];
}) {
  const [editing, setEditing] = useState<BillLite | null | "new">(null);
  const catIcon = (id: string) => categories.find((c) => c.id === id)?.icon ?? "Tag";
  const totalMonth = items.filter((i) => i.bill.type === "expense").reduce((a, i) => a + i.bill.amountCents, 0);
  const paidCount = items.filter((i) => i.paid).length;

  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-ink-2">
        Rent, insurance, subscriptions. Tap <strong className="font-semibold">Paid</strong> when a bill goes out and Hearth logs it in the right category.
      </p>
      <Button variant="secondary" className="w-full" onClick={() => setEditing("new")}>
        <Plus size={18} /> New bill
      </Button>

      {items.length === 0 ? (
        <Empty title="No recurring bills yet" body="Add the ones that hit every month so you never forget what's still due." />
      ) : (
        <>
          <p className="px-1 text-xs text-ink-3">
            {paidCount} of {items.length} paid · <span className="num">{fmtMoney(totalMonth, { whole: true })}</span> in bills this month
          </p>
          <ul className="divide-y divide-line rounded-card bg-card shadow-card">
            {items.map(({ bill, due, paid, paidDate, daysUntil }) => (
              <li key={bill.id} className="flex items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => setEditing(bill)} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${paid ? "bg-green-soft text-green-text" : "bg-card-2 text-ink-2"}`} aria-label={`Edit ${bill.name}`}>
                  <Icon name={catIcon(bill.categoryId)} size={18} />
                </button>
                <button type="button" onClick={() => setEditing(bill)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[15px] font-medium">{bill.name}</p>
                  <p className="text-xs text-ink-3">
                    {paid ? `Paid ${paidDate ? shortDate(paidDate) : ""}` : daysUntil < 0 ? <span className="text-over">Due {shortDate(due)} · overdue</span> : daysUntil === 0 ? "Due today" : `Due ${shortDate(due)}`}
                    {bill.type === "income" && " · income"}
                  </p>
                </button>
                <span className="num text-[15px] font-semibold">{fmtMoney(bill.amountCents)}</span>
                {paid ? <Pill tone="green">Paid</Pill> : <MarkPaidButton billId={bill.id} month={month} />}
              </li>
            ))}
          </ul>
        </>
      )}

      {inactive.length > 0 && (
        <details className="px-1 text-sm text-ink-3">
          <summary className="cursor-pointer py-2 font-medium">Paused ({inactive.length})</summary>
          <ul className="mt-2 divide-y divide-line rounded-card bg-card shadow-card">
            {inactive.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => setEditing(b)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Icon name={catIcon(b.categoryId)} size={18} className="text-ink-3" />
                  <span className="flex-1 text-ink-2">{b.name}</span>
                  <span className="num">{fmtMoney(b.amountCents)}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing !== null && <BillSheet onClose={() => setEditing(null)} bill={editing === "new" ? null : editing} categories={categories} />}
    </div>
  );
}

function BillSheet({
  onClose,
  bill,
  categories,
}: {
  onClose: () => void;
  bill: BillLite | null;
  categories: { id: string; name: string; icon: string; kind: "expense" | "income" }[];
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill ? centsToInput(bill.amountCents) : "");
  const [day, setDay] = useState(bill?.dayOfMonth ?? 1);
  const [type, setType] = useState<"expense" | "income">(bill?.type ?? "expense");
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? categories.find((c) => c.kind === "expense")?.id ?? "");
  const [active, setActive] = useState(bill?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const options = categories.filter((c) => c.kind === type);

  return (
    <Sheet
      open
      onClose={onClose}
      title={bill ? "Edit bill" : "New bill"}
      footer={
        <div className="flex gap-2">
          {bill && (
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                start(async () => {
                  const res = await deleteBill(bill.id);
                  if (!res.ok) return setError(res.error);
                  onClose();
                  toast({ message: "Bill deleted. Past payments stay in Activity." });
                });
              }}
            >
              {confirmDelete ? "Really delete?" : "Delete"}
            </Button>
          )}
          <Button
            className="flex-1"
            size="lg"
            disabled={pending}
            onClick={() => {
              const payload: BillInput = { id: bill?.id, name, amountCents: parseAmountToCents(amount) ?? 0, dayOfMonth: day, categoryId, type, active };
              start(async () => {
                const res = await saveBill(payload);
                if (!res.ok) return setError(res.error);
                onClose();
                toast({ message: bill ? "Bill updated" : "Bill added" });
              });
            }}
          >
            {bill ? "Save changes" : "Add bill"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2 pt-1">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rent, Car insurance, Netflix…" maxLength={60} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <Input inputMode="decimal" className="num" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1,850" />
          </Field>
          <Field label="Due on day">
            <Input type="number" min={1} max={31} className="num" value={day} onChange={(e) => setDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} />
          </Field>
        </div>
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 rounded-2xl bg-card-2 p-1">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={type === k}
              onClick={() => {
                setType(k);
                setCategoryId(categories.find((c) => c.kind === k)?.id ?? "");
              }}
              className={`h-9 rounded-xl text-sm font-medium ${type === k ? "bg-card shadow-sm" : "text-ink-2"}`}
            >
              {k === "expense" ? "Bill (expense)" : "Recurring income"}
            </button>
          ))}
        </div>
        <Field label="Category">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {bill && <Toggle checked={active} onChange={setActive} label="Active" description="Paused bills don't show as due." />}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
