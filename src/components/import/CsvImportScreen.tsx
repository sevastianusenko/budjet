"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronLeft, ClipboardCopy, FileUp } from "lucide-react";
import { deleteImportBatch, importHistory } from "@/actions/import-csv";
import { CSV_HEADER, parseHistoryCsv } from "@/lib/csv";
import type { MatchCategory, MatchSub } from "@/lib/receipt-parse";
import { fmtMoney } from "@/lib/money";
import { monthLabel } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { ErrorText, Select, Toggle, inputClass } from "@/components/ui/Field";
import { MemberDot } from "@/components/ui/Bits";
import { useToast } from "@/components/ui/Toast";

export function CsvImportScreen({
  categories,
  subcategories,
  members,
  meId,
  tithePct,
  prompt,
}: {
  categories: MatchCategory[];
  subcategories: MatchSub[];
  members: { id: string; name: string; color: string }[];
  meId: string;
  tithePct: number;
  prompt: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [remap, setRemap] = useState<Record<string, string>>({});
  const [paidBy, setPaidBy] = useState(meId);
  const [skipDup, setSkipDup] = useState(true);
  const [tithe, setTithe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseHistoryCsv(text, categories, subcategories, members, remap), [text, categories, subcategories, members, remap]);
  const good = parsed.rows.filter((r) => !r.problem);
  const bad = parsed.rows.filter((r) => r.problem);
  const months = useMemo(() => {
    const m = new Map<string, { income: number; expense: number; n: number }>();
    for (const r of good) {
      const key = r.date!.slice(0, 7);
      const v = m.get(key) ?? { income: 0, expense: 0, n: 0 };
      v[r.type === "income" ? "income" : "expense"] += r.amountCents!;
      v.n += 1;
      m.set(key, v);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [good]);
  const totals = good.reduce(
    (a, r) => {
      a[r.type === "income" ? "income" : "expense"] += r.amountCents!;
      return a;
    },
    { income: 0, expense: 0 },
  );

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ message: "Couldn't copy. Open the prompt below and copy it by hand.", tone: "error" });
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setText(await file.text());
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function save() {
    start(async () => {
      const res = await importHistory({
        rows: good.map((r) => ({
          date: r.date!,
          type: r.type!,
          categoryId: r.categoryId!,
          subcategoryId: r.subcategoryId,
          amountCents: r.amountCents!,
          note: r.note,
          userId: r.userId ?? paidBy,
        })),
        skipDuplicates: skipDup,
        tithe,
      });
      if (!res.ok) return setError(res.error);
      toast({
        message: `${res.imported} entries imported${res.skipped ? `, ${res.skipped} duplicates skipped` : ""}${res.uncategorized ? `, ${res.uncategorized} to sort` : ""}`,
        durationMs: 10000,
        action: {
          label: "Undo",
          onClick: async () => {
            const u = await deleteImportBatch(res.batchId);
            if (u.ok) toast({ message: `Import undone · ${u.removed} entries removed` });
          },
        },
      });
      router.push(res.uncategorized > 0 ? "/sort" : months.length ? `/activity?m=${months[months.length - 1][0]}` : "/activity");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 pt-2">
        <Link href="/import" aria-label="Back" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-card-2">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="display text-2xl font-semibold tracking-tight">Import history</h1>
      </div>

      <section className="rounded-card bg-card p-4 shadow-card">
        <ol className="space-y-2 text-sm text-ink-2">
          <li>
            <span className="font-semibold text-ink">1.</span> Export the period from your bank (CSV or PDF statement) or open your spreadsheet.
          </li>
          <li>
            <span className="font-semibold text-ink">2.</span> In ChatGPT attach that file, paste the prompt below, send. It returns a CSV sorted into your categories.
          </li>
          <li>
            <span className="font-semibold text-ink">3.</span> Save its answer as a .csv (or copy it) and bring it here. Check the summary, then import. One tap undoes the whole import.
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
      </section>

      <section className="rounded-card bg-card p-4 shadow-card">
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
          <FileUp size={18} /> Choose a .csv file
        </Button>
        <p className="my-2 text-center text-xs text-ink-3">or paste the CSV (cells copied from Excel work too)</p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder={`${CSV_HEADER}\n2026-07-01,expense,Groceries,Meat & fish,23.40,Costco,Sam\n2026-07-01,income,Paycheck,,3250.00,ACME payroll,`}
          rows={6}
          className={`${inputClass} h-auto min-h-36 py-3 font-mono text-[12px]`}
        />
      </section>

      {parsed.problems.map((p) => (
        <ErrorText key={p}>{p}</ErrorText>
      ))}

      {parsed.unmatched.length > 0 && (
        <section className="rounded-card border border-over/40 bg-card p-4 shadow-card">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-over">Categories I don&apos;t know</h2>
          <p className="mt-1 text-sm text-ink-2">Pick what each one should become. It applies to every row with that name.</p>
          <ul className="mt-3 space-y-2">
            {parsed.unmatched.map((u) => (
              <li key={u.name} className="grid grid-cols-[1fr_1fr] items-center gap-2">
                <span className="truncate text-sm">
                  {u.name} <span className="text-xs text-ink-3">· {u.count} row{u.count === 1 ? "" : "s"}</span>
                </span>
                <Select value={remap[u.name] ?? ""} onChange={(e) => setRemap((m) => ({ ...m, [u.name]: e.target.value }))} aria-label={`Category for ${u.name}`}>
                  <option value="">Choose…</option>
                  {categories
                    .filter((c) => c.kind === u.type && !c.archived)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsed.rows.length > 0 && (
        <section className="rounded-card bg-card p-4 shadow-card">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Ready to import</h2>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Stat label="Rows" value={String(good.length)} />
            <Stat label="Income" value={fmtMoney(totals.income, { whole: true })} cls="text-green-text" />
            <Stat label="Spending" value={fmtMoney(totals.expense, { whole: true })} />
          </div>
          {months.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                  <th className="pb-1 font-semibold">Month</th>
                  <th className="pb-1 text-right font-semibold">Rows</th>
                  <th className="pb-1 text-right font-semibold">Income</th>
                  <th className="pb-1 text-right font-semibold">Spending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {months.map(([m, v]) => (
                  <tr key={m}>
                    <td className="py-1.5">{monthLabel(m)}</td>
                    <td className="num py-1.5 text-right text-ink-2">{v.n}</td>
                    <td className="num py-1.5 text-right text-green-text">{fmtMoney(v.income, { whole: true })}</td>
                    <td className="num py-1.5 text-right">{fmtMoney(v.expense, { whole: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {bad.length > 0 && (
            <details className="mt-3 text-xs text-warn">
              <summary className="cursor-pointer">{bad.length} row{bad.length === 1 ? "" : "s"} will be skipped</summary>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto">
                {bad.slice(0, 50).map((r) => (
                  <li key={r.line}>
                    Line {r.line}: {r.problem}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-4 space-y-1 border-t border-line pt-3">
            {members.length > 1 && (
              <div className="flex items-center gap-2 py-1">
                <span className="flex-1 text-[15px]">Rows without “paid_by” go to</span>
                <div className="flex items-center gap-1 rounded-xl bg-card-2 p-1" role="radiogroup">
                  {members.map((m) => (
                    <button key={m.id} type="button" role="radio" aria-checked={paidBy === m.id} title={m.name} onClick={() => setPaidBy(m.id)} className={`rounded-lg p-1 ${paidBy === m.id ? "bg-card shadow-sm" : "opacity-40"}`}>
                      <MemberDot color={m.color} name={m.name} size="md" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Toggle checked={skipDup} onChange={setSkipDup} label="Skip rows already in Hearth" description="Same date, type, amount and note." />
            {tithePct > 0 && <Toggle checked={tithe} onChange={setTithe} label={`Set aside ${tithePct}% tithe from imported income`} description="Off is usually right for the past: the fund balance is set on the Goals tab instead." />}
          </div>
          <ErrorText>{error}</ErrorText>
          <Button size="lg" className="mt-3 w-full" disabled={pending || good.length === 0} onClick={save}>
            <Check size={20} /> {pending ? "Importing…" : `Import ${good.length} entr${good.length === 1 ? "y" : "ies"}`}
          </Button>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, cls = "text-ink" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-xl bg-card-2 px-2 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`num text-base font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
