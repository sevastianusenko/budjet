"use client";

import { useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { recategorize } from "@/actions/sort";
import { normalizeName } from "@/lib/receipt-parse";
import { dateLabel } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Empty, MemberDot } from "@/components/ui/Bits";
import { useToast } from "@/components/ui/Toast";
import { useAddSheet } from "@/components/shell/AppShell";

interface Entry {
  id: string;
  date: string;
  amountCents: number;
  note: string;
  userId: string;
}

/** Uncategorized entries grouped by merchant (note). One choice moves the whole group. */
export function SortScreen({
  entries,
  categories,
  subcategories,
  members,
  today,
  uncategorizedId,
}: {
  entries: Entry[];
  categories: { id: string; name: string; icon: string; group: string }[];
  subcategories: { id: string; categoryId: string; name: string }[];
  members: { id: string; name: string; color: string }[];
  today: string;
  uncategorizedId: string;
}) {
  const toast = useToast();
  const { openEdit } = useAddSheet();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<Record<string, { categoryId: string; subcategoryId: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = normalizeName(e.note) || "(no note)";
      (map.get(key) ?? map.set(key, []).get(key))!.push(e);
    }
    return [...map.entries()]
      .map(([key, list]) => ({ key, label: list[0].note || "No note", list, total: list.reduce((a, e) => a + e.amountCents, 0) }))
      .sort((a, b) => b.list.length - a.list.length || b.total - a.total);
  }, [entries]);

  const total = entries.reduce((a, e) => a + e.amountCents, 0);
  const grouped = useMemo(() => {
    const order = ["need", "want", "savings", "business"];
    return [...categories].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name));
  }, [categories]);

  function apply(key: string, ids: string[]) {
    const c = choice[key];
    if (!c?.categoryId) return;
    setBusy(key);
    start(async () => {
      const res = await recategorize({ ids, categoryId: c.categoryId, subcategoryId: c.subcategoryId || null });
      setBusy(null);
      if (!res.ok) return toast({ message: res.error, tone: "error" });
      const cat = categories.find((x) => x.id === c.categoryId)?.name ?? "category";
      toast({ message: `${res.moved} entr${res.moved === 1 ? "y" : "ies"} moved to ${cat}` });
    });
  }

  if (entries.length === 0) {
    return <Empty title="Nothing left to sort" body="Every entry has a category. Imports that can't decide on a category will show up here." />;
  }

  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-ink-2">
        <span className="num font-semibold text-ink">{entries.length}</span> entr{entries.length === 1 ? "y" : "ies"} · <span className="num font-semibold text-ink">{fmtMoney(total, { whole: true })}</span> waiting for a category. Pick one per merchant and it applies to all of its entries.
      </p>
      <ul className="space-y-3">
        {groups.map((g) => {
          const c = choice[g.key] ?? { categoryId: "", subcategoryId: "" };
          const subs = subcategories.filter((s) => s.categoryId === c.categoryId);
          return (
            <li key={g.key} className="rounded-card bg-card p-4 shadow-card">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="min-w-0 truncate text-[15px] font-semibold">{g.label}</h2>
                <span className="num shrink-0 text-sm text-ink-2">
                  {g.list.length} × · <span className="font-semibold text-ink">{fmtMoney(g.total, { whole: true })}</span>
                </span>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                <Select value={c.categoryId} onChange={(e) => setChoice((m) => ({ ...m, [g.key]: { categoryId: e.target.value, subcategoryId: "" } }))} aria-label={`Category for ${g.label}`}>
                  <option value="">Category…</option>
                  {grouped.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
                <Select value={c.subcategoryId} disabled={subs.length === 0} onChange={(e) => setChoice((m) => ({ ...m, [g.key]: { ...c, subcategoryId: e.target.value } }))} aria-label={`Subcategory for ${g.label}`}>
                  <option value="">{subs.length ? "No subcategory" : "—"}</option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Button size="md" disabled={!c.categoryId || pending} onClick={() => apply(g.key, g.list.map((e) => e.id))} aria-label={`Move ${g.label}`}>
                  <Check size={18} /> {busy === g.key ? "…" : "Move"}
                </Button>
              </div>
              <details className="mt-2 text-xs text-ink-3">
                <summary className="cursor-pointer">Show the {g.list.length} entr{g.list.length === 1 ? "y" : "ies"}</summary>
                <ul className="mt-1 divide-y divide-line">
                  {g.list.map((e) => {
                    const m = members.find((x) => x.id === e.userId);
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => openEdit({ id: e.id, type: "expense", amountCents: e.amountCents, date: e.date, categoryId: uncategorizedId, subcategoryId: null, goalId: null, note: e.note, userId: e.userId })}
                          className="flex w-full items-center gap-2 py-1.5 text-left text-ink-2 hover:text-ink"
                        >
                          {m && <MemberDot color={m.color} name={m.name} size="xs" />}
                          <span className="flex-1">{dateLabel(e.date, today)}</span>
                          <span className="num">{fmtMoney(e.amountCents)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
