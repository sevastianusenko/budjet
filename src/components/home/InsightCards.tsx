import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { Insight } from "@/lib/insights";

const TONE = {
  good: { icon: CircleCheck, cls: "text-green-text", bg: "bg-green-soft" },
  watch: { icon: TriangleAlert, cls: "text-warn", bg: "bg-warn-soft" },
  act: { icon: CircleAlert, cls: "text-over", bg: "bg-over-soft" },
  info: { icon: Info, cls: "text-save", bg: "bg-card-2" },
};

export function InsightCards({ insights, title = "Right now" }: { insights: Insight[]; title?: string }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-3">{title}</h2>
      <ul className="space-y-2">
        {insights.map((i) => {
          const t = TONE[i.tone];
          const I = t.icon;
          const inner = (
            <>
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.bg} ${t.cls}`}>
                <I size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug text-ink">{i.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-ink-2">{i.body}</span>
              </span>
              {i.href && <ArrowRight size={18} className="mt-2 shrink-0 text-ink-3" />}
            </>
          );
          const cls = "flex items-start gap-3 rounded-card bg-card p-4 shadow-card";
          return (
            <li key={i.id}>
              {i.href ? (
                <Link href={i.href} className={`${cls} hover:bg-card-2/60`}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
