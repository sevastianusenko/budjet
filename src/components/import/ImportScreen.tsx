"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronLeft, ClipboardCopy, Plus, X } from "lucide-react";
import { importEntries } from "@/actions/import";
import { describeItem, parseReceiptText, type MatchCategory, type MatchSub, type ParsedItem } from "@/lib/receipt-parse";
import { fmtMoney, parseAmountToCents } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Select, inputClass } from "@/components/ui/Field";
import { MemberDot } from "@/components/ui/Bits";
import { useToast } from "@/components/ui/Toast";

interface Row {
  key: number;
  categoryId: string;
  subcategoryId: string;
  amount: string;
  note: string;
  unmatched: string | null;
  items: ParsedItem[];
}

export function ImportScreen({
  categories,
  subcategories,
  members,
  meId,
  today,
  prompt,
}: {
  categories: (MatchCategory & { icon: string })[];
  subcategories: MatchSub[];
  members: { id: string; name: string; color: string }[];
  meId: string;
  today: string;
  prompt: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(today);
  const [store, setStore] = useState("");
  const [paidBy, setPaidBy] = useState(meId);
  const [problems, setProblems] = useState<string[]>([]);
  const [totalHint, setTotalHint] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const keyRef = useRef(1);

  const expenseCats = categories.filter((c) => c.kind === "expense" && !c.archived);
  const subsFor = (catId: string) => subcategories.filter((s) => s.categoryId === catId && !s.archived);

  function applyText(value: string) {
    setText(value);
    setError(null);
    const parsed = parseReceiptText(value, categories, subcategories);
    setRows(
      parsed.lines.map((l) => ({
        key: keyRef.current++,
        categoryId: l.categoryId ?? "",
        subcategoryId: l.subcategoryId ?? "",
        amount: (l.amountCents / 100).toFixed(2),
        note: l.note || (l.categoryId ? "" : l.raw),
        unmatched: l.unmatched,
        items: l.items,
      })),
    );
    if (parsed.date) setDate(parsed.date);
    if (parsed.store) setStore(parsed.store);
    setTotalHint(parsed.totalCents);
    setProblems(parsed.problems);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ message: "Couldn't copy. Open the prompt below and copy it by hand.", tone: "error" });
    }
  }

  const totalCents = useMemo(() => rows.reduce((a, r) => a + (parseAmountToCents(r.amount) ?? 0), 0), [rows]);
  const itemCount = rows.reduce((a, r) => a + r.items.length, 0);
  const ready = rows.length > 0 && rows.every((r) => r.categoryId && (parseAmountToCents(r.amount) ?? 0) > 0);

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, unmatched: patch.categoryId ? null : r.unmatched } : r)));
  }

  function save() {
    start(async () => {
      const res = await importEntries({
        date,
        store,
        userId: paidBy,
        totalCents: totalHint ?? undefined,
        lines: rows.map((r) => ({
          categoryId: r.categoryId,
          subcategoryId: r.subcategoryId || null,
          amountCents: parseAmountToCents(r.amount) ?? 0,
          note: r.note,
          items: r.items,
        })),
      });
      if (!res.ok) return setError(res.error);
      toast({ message: `Receipt saved · ${res.count} entr${res.count === 1 ? "y" : "ies"} · ${fmtMoney(res.totalCents)}` });
      router.push(`/receipts/${res.receiptId}`);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 pt-2">
        <Link href="/home" aria-label="Back" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-card-2">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="display text-2xl font-semibold tracking-tight">Import a receipt</h1>
      </div>

      <section className="rounded-card bg-card p-4 shadow-card">
        <ol className="space-y-2 text-sm text-ink-2">
          <li>
            <span className="font-semibold text-ink">1.</span> Tap <strong className="font-semibold text-ink">Copy prompt</strong>. It already lists your categories and subcategories.
          </li>
          <li>
            <span className="font-semibold text-ink">2.</span> In ChatGPT (or any assistant) attach a photo of the receipt, paste the prompt, send.
          </li>
          <li>
            <span className="font-semibold text-ink">3.</span> Copy its answer and paste it below. Every item is kept: what, how much, price per pound.
          </li>
        </ol>
        <div className="mt-3 flex gap-2">
          <Button onClick={copyPrompt}>
            <ClipboardCopy size={18} /> {copied ? "Copied!" : "Copy prompt"}
          </Button>
          <details className="min-w-0 flex-1 text-xs text-ink-3">
            <summary className="cursor-pointer py-2.5">Show prompt</summary>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-card-2 p-3 text-[11px] leading-snug text-ink-2">{prompt}</pre>
          </details>
        </div>
        <textarea
          value={text}
          onChange={(e) => applyText(e.target.value)}
          placeholder={"Paste the answer here, e.g.\nstore: Costco\nGroceries / Meat & fish: 23.40\n  - Chicken thighs, 3.2 lb @ 2.99/lb = 9.57\n  - Ground beef, 2 lb @ 6.92/lb = 13.83"}
          rows={7}
          className={`${inputClass} mt-3 h-auto min-h-40 py-3 font-mono text-[13px]`}
        />
        <p className="mt-2 text-xs text-ink-3">You can also type lines by hand in the same shape. Items go on indented lines starting with “- ”.</p>
      </section>

      {rows.length > 0 && (
        <section className="rounded-card bg-card p-4 shadow-card">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Check and save</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Store">
              <Input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Costco" maxLength={80} />
            </Field>
          </div>
          {members.length > 1 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[13px] font-medium text-ink-2">Paid by</span>
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
            </div>
          )}

          <ul className="mt-4 space-y-3">
            {rows.map((r) => {
              const subs = subsFor(r.categoryId);
              return (
                <li key={r.key} className={`rounded-2xl border p-3 ${r.categoryId ? "border-line" : "border-over/60 bg-over-soft/30"}`}>
                  {!r.categoryId && <p className="mb-2 text-xs font-medium text-over">Couldn&apos;t match “{r.unmatched}”. Pick a category:</p>}
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Select value={r.categoryId} onChange={(e) => update(r.key, { categoryId: e.target.value, subcategoryId: "" })} aria-label="Category">
                      <option value="">Category…</option>
                      {expenseCats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                    <Input inputMode="decimal" className="num w-28 text-right" value={r.amount} onChange={(e) => update(r.key, { amount: e.target.value })} aria-label="Amount" />
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Select value={r.subcategoryId} onChange={(e) => update(r.key, { subcategoryId: e.target.value })} aria-label="Subcategory" disabled={subs.length === 0}>
                      <option value="">{subs.length ? "No subcategory" : "—"}</option>
                      {subs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                    <Input value={r.note} onChange={(e) => update(r.key, { note: e.target.value })} placeholder="Note" maxLength={120} />
                    <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove line" className="flex h-12 w-10 items-center justify-center rounded-xl text-ink-3 hover:bg-over-soft hover:text-over">
                      <X size={18} />
                    </button>
                  </div>
                  {r.items.length > 0 && (
                    <ul className="mt-2 divide-y divide-line rounded-xl bg-card-2/60 px-3 text-sm">
                      {r.items.map((it, i) => (
                        <li key={i} className="flex items-center gap-2 py-1.5">
                          <span className="min-w-0 flex-1 truncate">
                            {it.name}
                            {describeItem(it) && <span className="text-xs text-ink-3"> · {describeItem(it)}</span>}
                          </span>
                          <span className="num text-ink-2">{fmtMoney(it.amountCents)}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${it.name}`}
                            onClick={() => update(r.key, { items: r.items.filter((_, j) => j !== i) })}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-over-soft hover:text-over"
                          >
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { key: keyRef.current++, categoryId: "", subcategoryId: "", amount: "", note: "", unmatched: null, items: [] }])}
            className="mt-3 flex items-center gap-1 text-sm font-medium text-green-text"
          >
            <Plus size={16} /> Add a line
          </button>

          {problems.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-warn">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <ErrorText>{error}</ErrorText>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-2">
              {rows.length} line{rows.length === 1 ? "" : "s"}
              {itemCount > 0 && `, ${itemCount} item${itemCount === 1 ? "" : "s"}`} · <span className="num font-semibold text-ink">{fmtMoney(totalCents)}</span>
              {totalHint !== null && Math.abs(totalHint - totalCents) > 100 && <span className="text-warn"> (receipt says {fmtMoney(totalHint)})</span>}
            </p>
            <Button onClick={save} disabled={!ready || pending}>
              <Check size={18} /> Save
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
