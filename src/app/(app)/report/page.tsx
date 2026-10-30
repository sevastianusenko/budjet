import { requireViewer } from "@/lib/auth";
import { loadHousehold, type SearchParams } from "@/lib/queries";
import { resolvePeriod } from "@/lib/period";
import { buildReport } from "@/lib/report";
import { fmtMoney, fmtPct } from "@/lib/money";
import { dateLabel, shortDate } from "@/lib/dates";
import { Icon } from "@/components/ui/Icon";
import { MemberDot } from "@/components/ui/Bits";
import { ReportControls } from "@/components/report/ReportControls";

export const metadata = { title: "Report" };

export default async function ReportPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const period = resolvePeriod(sp, viewer.today);
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const r = buildReport(data, viewer.household, period, viewer.today);
  const multi = period.months.length > 1;
  const t = r.totals;

  return (
    <div className="space-y-5 print:space-y-4">
      <ReportControls period={period} csvHref={`/api/export?from=${period.start}&to=${period.end}`} />

      <header className="print:mb-2">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{r.householdName} · budget report</p>
        <h1 className="display text-3xl font-semibold tracking-tight">{period.label}</h1>
        <p className="mt-1 text-xs text-ink-3">
          Generated {dateLabel(r.generated, viewer.today)} · {t.entries} entries{r.receipts > 0 && ` · ${r.receipts} receipts`}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2 print:grid-cols-4">
        <Tile label="Income" value={fmtMoney(t.income, { whole: true })} tone="good" />
        <Tile label="Spent" value={fmtMoney(t.spent, { whole: true })} hint={t.business > 0 ? `incl. business ${fmtMoney(t.business, { whole: true })}` : undefined} />
        <Tile label="Saved" value={fmtMoney(t.saved, { whole: true })} hint={t.goalContributions ? `${fmtMoney(t.goalContributions, { whole: true })} to goals` : undefined} tone="save" />
        <Tile label="Savings rate" value={t.savingsRate === null ? "—" : fmtPct(t.savingsRate)} hint={t.savingsRate === null ? "no income logged" : `target ${viewer.household.savingsPct}%`} />
      </section>

      {(t.titheSetAside > 0 || t.titheGiven > 0) && (
        <p className="rounded-card bg-card px-4 py-3 text-sm shadow-card print:border print:border-line print:shadow-none">
          Tithe: <span className="num font-semibold">{fmtMoney(t.titheSetAside, { whole: true })}</span> set aside, <span className="num font-semibold">{fmtMoney(t.titheGiven, { whole: true })}</span> given from the fund.
        </p>
      )}

      <Section title={`${viewer.household.needsPct}/${viewer.household.wantsPct}/${viewer.household.savingsPct} check`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
              <th className="pb-1.5 font-semibold">Bucket</th>
              <th className="pb-1.5 text-right font-semibold">Amount</th>
              <th className="pb-1.5 text-right font-semibold">Of income</th>
              <th className="pb-1.5 text-right font-semibold">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {r.split.map((s) => (
              <tr key={s.label}>
                <td className="flex items-center gap-2 py-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.label}
                </td>
                <td className="num py-1.5 text-right font-semibold">{fmtMoney(s.actual, { whole: true })}</td>
                <td className={`num py-1.5 text-right ${s.targetShare !== null && s.label !== "Saving" && s.share > s.targetShare + 0.02 ? "text-over" : ""}`}>{fmtPct(s.share)}</td>
                <td className="num py-1.5 text-right text-ink-3">{s.targetShare === null ? "—" : fmtPct(s.targetShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {multi && (
        <Section title="Month by month">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                <th className="pb-1.5 font-semibold">Month</th>
                <th className="pb-1.5 text-right font-semibold">Income</th>
                <th className="pb-1.5 text-right font-semibold">Spent</th>
                <th className="pb-1.5 text-right font-semibold">Saved</th>
                <th className="pb-1.5 text-right font-semibold">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.months.map((m) => (
                <tr key={m.month}>
                  <td className="py-1.5">{m.label}</td>
                  <td className="num py-1.5 text-right text-green-text">{fmtMoney(m.income, { whole: true })}</td>
                  <td className="num py-1.5 text-right">{fmtMoney(m.spent, { whole: true })}</td>
                  <td className="num py-1.5 text-right text-save">{fmtMoney(m.saved, { whole: true })}</td>
                  <td className="num py-1.5 text-right text-ink-2">{m.rate === null ? "—" : fmtPct(m.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Spending by category">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
              <th className="pb-1.5 font-semibold">Category</th>
              <th className="pb-1.5 text-right font-semibold">Planned</th>
              <th className="pb-1.5 text-right font-semibold">Spent</th>
              <th className="pb-1.5 text-right font-semibold">Diff</th>
              <th className="pb-1.5 text-right font-semibold">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {r.categories.map((c) => {
              const diff = c.planned - c.spent;
              return [
                <tr key={c.id}>
                  <td className="flex items-center gap-2 py-1.5">
                    <Icon name={c.icon} size={14} className="shrink-0 text-ink-3" />
                    <span className="truncate font-medium">{c.name}</span>
                    {c.group === "business" && <span className="text-[10px] uppercase text-ink-3">business</span>}
                  </td>
                  <td className="num py-1.5 text-right text-ink-2">{c.planned ? fmtMoney(c.planned, { whole: true }) : "—"}</td>
                  <td className="num py-1.5 text-right font-semibold">{fmtMoney(c.spent, { whole: true })}</td>
                  <td className={`num py-1.5 text-right ${c.planned ? (diff < 0 ? "text-over" : "text-green-text") : "text-ink-3"}`}>{c.planned ? fmtMoney(diff, { whole: true, signed: true }) : "—"}</td>
                  <td className="num py-1.5 text-right text-ink-3">{fmtPct(c.share)}</td>
                </tr>,
                ...c.subs.map((s) => (
                  <tr key={`${c.id}-${s.name}`} className="text-xs text-ink-2">
                    <td className="py-1 pl-6">{s.name}</td>
                    <td />
                    <td className="num py-1 text-right">{fmtMoney(s.spent, { whole: true })}</td>
                    <td />
                    <td className="num py-1 text-right text-ink-3">{c.spent ? fmtPct(s.spent / c.spent) : ""}</td>
                  </tr>
                )),
              ];
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong font-semibold">
              <td className="pt-2">Total</td>
              <td className="num pt-2 text-right text-ink-2">{fmtMoney(r.categories.reduce((a, c) => a + c.planned, 0), { whole: true })}</td>
              <td className="num pt-2 text-right">{fmtMoney(t.spent, { whole: true })}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </Section>

      {r.goals.length > 0 && (
        <Section title="Goals">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                <th className="pb-1.5 font-semibold">Goal</th>
                <th className="pb-1.5 text-right font-semibold">{multi ? "Added" : "This month"}</th>
                <th className="pb-1.5 text-right font-semibold">Balance at end</th>
                <th className="pb-1.5 text-right font-semibold">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.goals.map((g) => (
                <tr key={g.name}>
                  <td className="flex items-center gap-2 py-1.5">
                    <Icon name={g.icon} size={14} className="text-ink-3" /> {g.name}
                  </td>
                  <td className="num py-1.5 text-right">{fmtMoney(g.contributed, { whole: true, signed: true })}</td>
                  <td className="num py-1.5 text-right font-semibold">{fmtMoney(g.savedAtEnd, { whole: true })}</td>
                  <td className="num py-1.5 text-right text-ink-3">{g.isTithe || !g.target ? "—" : fmtMoney(g.target, { whole: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {r.members.length > 1 && (
        <Section title="Who logged what">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {r.members.map((m) => (
                <tr key={m.name}>
                  <td className="flex items-center gap-2 py-1.5">
                    <MemberDot color={m.color} name={m.name} size="sm" /> {m.name}
                  </td>
                  <td className="py-1.5 text-right text-xs text-ink-3">{m.count} entries</td>
                  <td className="num py-1.5 text-right text-green-text">{m.income ? fmtMoney(m.income, { whole: true }) : ""}</td>
                  <td className="num py-1.5 text-right font-semibold">{fmtMoney(m.spent, { whole: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {r.top.length > 0 && (
        <Section title="Largest purchases">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {r.top.map((e, i) => (
                <tr key={i}>
                  <td className="py-1.5 text-xs text-ink-3">{shortDate(e.date)}</td>
                  <td className="py-1.5">
                    {e.name}
                    {e.sub && <span className="text-ink-2"> · {e.sub}</span>}
                    {e.note && <span className="block text-xs text-ink-3">{e.note}</span>}
                  </td>
                  <td className="py-1.5 text-right text-xs text-ink-3">{e.member}</td>
                  <td className="num py-1.5 text-right font-semibold">{fmtMoney(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <p className="text-center text-[11px] text-ink-3 print:mt-6">Hearth · {r.householdName} · {period.label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-card bg-card p-4 shadow-card print:border print:border-line print:shadow-none">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">{title}</h2>
      {children}
    </section>
  );
}

function Tile({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "neutral" | "good" | "save" }) {
  const cls = tone === "good" ? "text-green-text" : tone === "save" ? "text-save" : "text-ink";
  return (
    <div className="rounded-card bg-card px-4 py-3 shadow-card print:border print:border-line print:shadow-none">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`display mt-0.5 text-2xl font-semibold tracking-tight ${cls}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
