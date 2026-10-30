import type { MonthSummary } from "@/lib/calc";
import { fmtMoney } from "@/lib/money";
import { shortDate, weekdayOf } from "@/lib/dates";
import { Explain } from "@/components/ui/Explain";

/**
 * The month as a calendar of spending. Each day is a cell; its fill is the
 * day's spending relative to the month's biggest day, colored by whoever
 * spent the most that day. Empty cells are no-spend days. Today is outlined.
 */
export function PulseStrip({
  summary: s,
  members,
}: {
  summary: MonthSummary;
  members: { id: string; name: string; color: string }[];
}) {
  const colorOf = new Map(members.map((m) => [m.id, m.color]));
  const nameOf = new Map(members.map((m) => [m.id, m.name]));
  const max = Math.max(1, ...s.byDay.map((d) => d.spent));
  const leadBlanks = weekdayOf(`${s.month}-01`);
  const elapsed = s.byDay.filter((d) => s.status === "past" || d.date <= s.today);
  const noSpend = elapsed.filter((d) => d.spent === 0).length;
  const biggest = [...s.byDay].sort((a, b) => b.spent - a.spent)[0];
  const anySpend = s.byDay.some((d) => d.spent > 0);

  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Month pulse</h2>
        <Explain title="Month pulse">
          <p>Every square is a day. The darker the square, the more was spent that day compared with the month&apos;s biggest day.</p>
          <p>The color is whoever spent the most that day. An empty square is a no-spend day. Today has an outline.</p>
          <p>Use it to spot weekends, paydays, and the rhythm of the month at a glance.</p>
        </Explain>
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={`Daily spending for ${s.month}`}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-center text-[10px] font-medium text-ink-3">
            {d}
          </span>
        ))}
        {Array.from({ length: leadBlanks }).map((_, i) => (
          <span key={`b${i}`} />
        ))}
        {s.byDay.map((d) => {
          const isToday = d.date === s.today;
          const future = s.status === "future" || d.date > s.today;
          const intensity = d.spent > 0 ? 0.25 + 0.75 * (d.spent / max) : 0;
          const color = d.topUserId ? colorOf.get(d.topUserId) ?? "var(--ink-2)" : "transparent";
          const title = d.spent
            ? `${shortDate(d.date)} · ${fmtMoney(d.spent)} · ${d.topUserId ? nameOf.get(d.topUserId) ?? "" : ""} · ${d.count} entr${d.count === 1 ? "y" : "ies"}`
            : `${shortDate(d.date)} · no spending`;
          return (
            <span
              key={d.date}
              title={title}
              className={`relative aspect-square rounded-md ${future ? "bg-card-2/50" : "bg-card-2"} ${isToday ? "ring-2 ring-ink ring-offset-1 ring-offset-card" : ""}`}
            >
              {d.spent > 0 && <span className="absolute inset-0 rounded-md" style={{ backgroundColor: color, opacity: intensity }} />}
              <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-medium ${d.spent > 0 && intensity > 0.6 ? "text-white" : "text-ink-3"}`}>
                {Number(d.date.slice(8))}
              </span>
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        {!anySpend && "Nothing logged yet this month. Each day fills in as you add entries."}
        {anySpend && elapsed.length > 0 && (
          <>
            <span className="font-medium text-ink-2">{noSpend}</span> no-spend day{noSpend === 1 ? "" : "s"}
          </>
        )}
        {biggest?.spent ? (
          <>
            {" · "}biggest day {shortDate(biggest.date)} <span className="num font-medium text-ink-2">{fmtMoney(biggest.spent, { whole: true })}</span>
          </>
        ) : null}
      </p>
    </section>
  );
}
