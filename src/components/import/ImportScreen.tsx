"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Camera, Check, ChevronLeft, ClipboardCopy, Plus, Sparkles, X } from "lucide-react";
import { importEntries } from "@/actions/import";
import { scanReceipt } from "@/actions/scan";
import { parseReceiptText, type MatchCategory, type MatchSub } from "@/lib/receipt-parse";
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
}

export function ImportScreen({
  categories,
  subcategories,
  members,
  meId,
  today,
  prompt,
  aiEnabled,
}: {
  categories: (MatchCategory & { icon: string })[];
  subcategories: MatchSub[];
  members: { id: string; name: string; color: string }[];
  meId: string;
  today: string;
  prompt: string;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(today);
  const [store, setStore] = useState("");
  const [paidBy, setPaidBy] = useState(meId);
  const [problems, setProblems] = useState<string[]>([]);
  const [totalHint, setTotalHint] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
      toast({ message: "Couldn't copy. Select the prompt text and copy it by hand.", tone: "error" });
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setScanning(true);
    setError(null);
    try {
      const { data, mediaType } = await shrinkImage(file);
      const res = await scanReceipt({ data, mediaType });
      if (!res.ok) return setError(res.error);
      applyText(res.text);
      toast({ message: "Receipt read. Check the lines, then save." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that photo.");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const totalCents = useMemo(() => rows.reduce((a, r) => a + (parseAmountToCents(r.amount) ?? 0), 0), [rows]);
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
        lines: rows.map((r) => ({
          categoryId: r.categoryId,
          subcategoryId: r.subcategoryId || null,
          amountCents: parseAmountToCents(r.amount) ?? 0,
          note: r.note,
        })),
      });
      if (!res.ok) return setError(res.error);
      toast({ message: `${res.count} entr${res.count === 1 ? "y" : "ies"} saved · ${fmtMoney(res.totalCents)}` });
      router.push("/activity");
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
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">
          <Sparkles size={14} /> Scan with AI
        </h2>
        {aiEnabled ? (
          <>
            <p className="mt-1 text-sm text-ink-2">Take a photo of the receipt. It&apos;s split into your categories and subcategories; you check the lines and save.</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
            <Button className="mt-3 w-full" size="lg" disabled={scanning} onClick={() => fileRef.current?.click()}>
              <Camera size={20} /> {scanning ? "Reading the receipt…" : "Take a photo or choose one"}
            </Button>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-2">
            Not set up yet. Add an <code className="rounded bg-card-2 px-1 text-xs">ANTHROPIC_API_KEY</code> environment variable to the server and this turns into a one-tap photo scan. Until then, use the paste option below.
          </p>
        )}
      </section>

      <section className="rounded-card bg-card p-4 shadow-card">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">
          <ClipboardCopy size={14} /> Paste from ChatGPT or any assistant
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Copy the prompt, paste it into ChatGPT together with the receipt photo, then paste the answer here. The prompt already lists your categories, so the answer drops straight in.
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={copyPrompt}>
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
          placeholder={"Paste the answer here, e.g.\nGroceries / Meat & fish: 23.40\nGroceries / Vegetables & fruit: 15.10\ndate: 2026-10-30\nstore: Costco"}
          rows={6}
          className={`${inputClass} mt-3 h-auto min-h-36 py-3 font-mono text-[13px]`}
        />
      </section>

      {rows.length > 0 && (
        <section className="rounded-card bg-card p-4 shadow-card">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Check and save</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Store (goes into notes)">
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
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { key: keyRef.current++, categoryId: "", subcategoryId: "", amount: "", note: "", unmatched: null }])}
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
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-ink-2">
              {rows.length} line{rows.length === 1 ? "" : "s"} · <span className="num font-semibold text-ink">{fmtMoney(totalCents)}</span>
              {totalHint !== null && Math.abs(totalHint - totalCents) > 100 && <span className="text-warn"> (receipt says {fmtMoney(totalHint)})</span>}
            </p>
            <Button onClick={save} disabled={!ready || pending}>
              <Check size={18} /> Save {rows.length}
            </Button>
          </div>
        </section>
      )}
      {rows.length === 0 && error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

/** Resize on the phone so uploads stay small (max 1600px, JPEG). */
async function shrinkImage(file: File): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the image.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { data: dataUrl.split(",")[1] ?? "", mediaType: "image/jpeg" };
}
