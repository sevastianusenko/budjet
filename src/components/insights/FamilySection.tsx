"use client";

import Link from "next/link";
import { fmtMoney, fmtPct } from "@/lib/money";
import { BusinessChart, GivingChart } from "./TrendCharts";
import { Legend, Section } from "./Shared";
import type { InsightsData } from "./types";

export function FamilySection({ d }: { d: InsightsData }) {
  const g = d.giving;
  const b = d.business;
  if (!g && !b) return null;
  const months = d.months.length;
  return (
    <div id="ours" className="scroll-mt-24 space-y-4">
      {g && (
        <Section
          title="Giving"
          explain={
            <>
              <p>Set aside: what moved into the Tithe fund from each income ({g.tithePct}% of every income when the tithe is on). Given: what left the fund for church or people, plus anything given from your own money in Tithe or Gifts & Giving.</p>
              <p>The line is the fund balance: what is still waiting to be given. &quot;Share of income given&quot; counts what actually went out, not what was set aside.</p>
            </>
          }
        >
          <p className="mb-3 text-sm text-ink-2">
            Over {months} month{months === 1 ? "" : "s"}: set aside <span className="num font-semibold text-ink">{fmtMoney(g.totals.setAside, { whole: true })}</span>, gave{" "}
            <span className="num font-semibold text-ink">{fmtMoney(g.totals.given, { whole: true })}</span>
            {g.totals.income > 0 && <> ({fmtPct(g.totals.given / g.totals.income)} of income)</>}. Fund balance now{" "}
            <span className="num font-semibold text-ink">{fmtMoney(g.points[g.points.length - 1]?.fundBalance ?? 0, { whole: true })}</span>.
          </p>
          <Legend items={[{ label: "Set aside", color: "var(--need)" }, { label: "Given from fund", color: "var(--save)" }, { label: "Given from own money", color: "var(--warn)" }, { label: "Fund balance", color: "var(--ink)", dot: true }]} />
          <GivingChart points={g.points} />
        </Section>
      )}
      {b && (
        <Section
          title="Business"
          explain={
            <>
              <p>Business income (income categories named Business) against business expenses (the Business group). The line is the net per month. All of it stays out of the family 50/30/20 and the plan comparisons.</p>
              <p>For taxes, the printable yearly report lists every business entry with its subcategory.</p>
            </>
          }
        >
          <p className="mb-3 text-sm text-ink-2">
            Over {months} month{months === 1 ? "" : "s"}: in <span className="num font-semibold text-ink">{fmtMoney(b.totals.income, { whole: true })}</span>, out{" "}
            <span className="num font-semibold text-ink">{fmtMoney(b.totals.expenses, { whole: true })}</span>, net{" "}
            <span className={`num font-semibold ${b.totals.net < 0 ? "text-over" : "text-green-text"}`}>{fmtMoney(b.totals.net, { whole: true, signed: true })}</span>.
          </p>
          <Legend items={[{ label: "Business income", color: "var(--green)" }, { label: "Business expenses", color: "var(--ink-3)" }, { label: "Net", color: "var(--save)", dot: true }]} />
          <BusinessChart points={b.points} />
          {b.topSubs.length > 0 && (
            <ul className="mt-3 divide-y divide-line text-sm">
              {b.topSubs.map((s) => (
                <li key={s.name} className="flex items-center justify-between py-1.5">
                  <span className="truncate">{s.name}</span>
                  <span className="num font-semibold">{fmtMoney(s.total, { whole: true })}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-3">
            <Link href={`/report?period=year&key=${b.year}`} className="font-medium text-green-text underline-offset-2 hover:underline">
              Yearly report for taxes
            </Link>
          </p>
        </Section>
      )}
    </div>
  );
}
