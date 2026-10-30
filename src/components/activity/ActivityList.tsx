"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Transaction } from "@/db/schema";
import { dateLabel } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { Empty, MemberDot, Money } from "@/components/ui/Bits";
import { TxRow } from "./TxRow";
import type { ItemLite } from "@/lib/items";

type Filter = "all" | "expense" | "income" | "goal";

export function ActivityList({
  txs,
  members,
  categories,
  subcategories,
  goals,
  itemsByTx = {},
  today,
}: {
  txs: Transaction[];
  members: { id: string; name: string; color: string }[];
  categories: { id: string; name: string; icon: string }[];
  subcategories: { id: string; name: string }[];
  goals: { id: string; name: string; icon: string; isTithe?: boolean }[];
  itemsByTx?: Record<string, ItemLite[]>;
  today: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [member, setMember] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const totals = useMemo(() => {
    const t = { income: 0, expense: 0, goal: 0 };
    for (const x of txs) t[x.type] += x.amountCents;
    return t;
  }, [txs]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const catName = (id: string | null) => categories.find((c) => c.id === id)?.name.toLowerCase() ?? "";
    const goalName = (id: string | null) => goals.find((g) => g.id === id)?.name.toLowerCase() ?? "";
    const subName = (id: string | null) => subcategories.find((s) => s.id === id)?.name.toLowerCase() ?? "";
    return txs.filter(
      (t) =>
        (filter === "all" || t.type === filter) &&
        (!member || t.userId === member) &&
        (!needle ||
          t.note.toLowerCase().includes(needle) ||
          catName(t.categoryId).includes(needle) ||
          subName(t.subcategoryId).includes(needle) ||
          goalName(t.goalId).includes(needle) ||
          (t.amountCents / 100).toFixed(2).includes(needle)),
    );
  }, [txs, filter, member, q, categories, subcategories, goals]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of visible) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "expense", label: "Spent" },
    { id: "income", label: "Income" },
    { id: "goal", label: "Goals" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="In" cents={totals.income} cls="text-green-text" />
        <Stat label="Out" cents={totals.expense} cls="text-ink" />
        <Stat label="Set aside" cents={totals.goal} cls="text-save" />
      </div>

      <div className="space-y-2">
        <label className="relative block">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes, categories, amounts"
            className="h-11 w-full rounded-2xl border border-line bg-card pl-10 pr-4 text-[15px] placeholder:text-ink-3 focus:border-green focus:outline-none"
          />
        </label>
        <div className="flex items-center gap-2">
          <div role="tablist" className="flex flex-1 rounded-xl bg-card-2 p-1">
            {filters.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`h-8 flex-1 rounded-lg text-[13px] font-medium ${filter === f.id ? "bg-card text-ink shadow-sm" : "text-ink-2"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {members.length > 1 && (
            <div className="flex items-center gap-1 rounded-xl bg-card-2 p-1" role="radiogroup" aria-label="Filter by member">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={member === m.id}
                  title={m.name}
                  onClick={() => setMember(member === m.id ? null : m.id)}
                  className={`rounded-lg p-0.5 transition-opacity ${member === null || member === m.id ? "opacity-100" : "opacity-35"} ${member === m.id ? "bg-card shadow-sm" : ""}`}
                >
                  <MemberDot color={m.color} name={m.name} size="md" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <Empty title={txs.length === 0 ? "Nothing logged this month" : "No matches"} body={txs.length === 0 ? "Tap + to add an expense, income, or a transfer to a goal." : "Try a different filter or search."} />
      ) : (
        <div className="space-y-4">
          {groups.map(([date, items]) => {
            const dayOut = items.filter((t) => t.type === "expense").reduce((a, t) => a + t.amountCents, 0);
            return (
              <section key={date}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <h2 className="text-[13px] font-semibold text-ink-2">{dateLabel(date, today)}</h2>
                  {dayOut > 0 && <span className="num text-xs text-ink-3">{fmtMoney(dayOut)}</span>}
                </div>
                <ul className="divide-y divide-line rounded-card bg-card shadow-card">
                  {items.map((t) => (
                    <TxRow key={t.id} tx={t} members={members} categories={categories} subcategories={subcategories} goals={goals} items={itemsByTx[t.id]} today={today} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, cents, cls }: { label: string; cents: number; cls: string }) {
  return (
    <div className="rounded-card bg-card px-3 py-2.5 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <Money cents={cents} whole className={`text-lg font-semibold ${cls}`} />
    </div>
  );
}
