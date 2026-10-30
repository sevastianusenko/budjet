import Link from "next/link";
import { Settings } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { loadHousehold, resolveMonth, toCatLite, toGoalLite, toSubLite, toTxLite, type SearchParams } from "@/lib/queries";
import { avgMonthlyNeeds, emergencyMonths, goalProgress, summarizeMonth } from "@/lib/calc";
import { buildCategoryDetails } from "@/lib/details";
import { buildInsights } from "@/lib/insights";
import { monthOf } from "@/lib/dates";
import { MonthSwitcher } from "@/components/shell/MonthSwitcher";
import { MemberDot } from "@/components/ui/Bits";
import { SafeToSpendCard } from "@/components/home/SafeToSpendCard";
import { PulseStrip } from "@/components/home/PulseStrip";
import { SplitBar } from "@/components/home/SplitBar";
import { InsightCards } from "@/components/home/InsightCards";
import { CategoryPulse } from "@/components/home/CategoryPulse";
import { UpcomingBills } from "@/components/home/UpcomingBills";
import { RecentActivity } from "@/components/home/RecentActivity";
import { TitheFundCard } from "@/components/home/TitheFundCard";
import { titheStats } from "@/lib/tithe-stats";
import { titheDefaults, titheLabeler } from "@/lib/tithe-ui";

export const metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const month = resolveMonth(sp.m, viewer.today);
  const data = await loadHousehold(viewer.household.id, viewer.today);

  const txs = data.txs.map(toTxLite);
  const cats = data.categories.map(toCatLite);
  const subs = data.subcategories.map(toSubLite);
  const goals = data.goals.map(toGoalLite);
  const summary = summarizeMonth({
    month,
    today: viewer.today,
    txs,
    cats,
    budgets: data.budgets,
    goals,
    expectedIncomeCents: viewer.household.expectedIncomeCents,
    targets: { needs: viewer.household.needsPct, wants: viewer.household.wantsPct, savings: viewer.household.savingsPct },
    tithePct: viewer.household.tithePct,
  });
  const progress = goals.filter((g) => !g.archived).map((g) => goalProgress(g, txs, viewer.today));
  const ef = progress.find((p) => p.goal.isEmergency);
  const efMonths = ef ? emergencyMonths(ef.saved, avgMonthlyNeeds(txs, cats, viewer.today, data.budgets)) : null;
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? "Uncategorized";
  const insights = buildInsights({ summary, goals: progress, emergencyMonths: efMonths, catName }).slice(0, 3);

  const members = data.members.map((m) => ({ id: m.id, name: m.name, color: m.color }));
  const details = buildCategoryDetails(summary, data.txs, txs, subs, members);
  const titheGoal = goals.find((g) => g.isTithe && !g.archived);
  const tithe = titheGoal ? titheStats(titheGoal, txs, viewer.today, month, titheLabeler(data.categories, data.subcategories)) : null;
  const titheDefs = titheDefaults(data.categories, data.subcategories);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {members.map((m) => (
              <span key={m.id} className="rounded-full ring-2 ring-paper">
                <MemberDot color={m.color} name={m.name} size="md" />
              </span>
            ))}
          </div>
          <h1 className="display text-lg font-semibold tracking-tight">{viewer.household.name}</h1>
        </div>
        <Link href="/settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-card-2">
          <Settings size={22} />
        </Link>
      </header>

      <MonthSwitcher month={month} currentMonth={monthOf(viewer.today)} />

      <SafeToSpendCard summary={summary} />

      <PulseStrip summary={summary} members={members} />

      <SplitBar summary={summary} />

      {tithe && <TitheFundCard stats={tithe} tithePct={viewer.household.tithePct} churchDefaults={titheDefs.church} helpDefaults={titheDefs.help} compact />}

      {insights.length > 0 && <InsightCards insights={insights} />}

      <CategoryPulse details={details} month={month} marker={summary.status === "current" ? summary.dayOfMonth / summary.daysInMonth : null} today={viewer.today} />

      <UpcomingBills bills={data.recurring} txs={data.txs} month={month} today={viewer.today} categories={data.categories} />

      <RecentActivity
        txs={data.txs.filter((t) => t.date.startsWith(month)).slice(0, 6)}
        members={members}
        categories={data.categories}
        subcategories={data.subcategories}
        goals={data.goals}
        today={viewer.today}
        month={month}
      />
    </div>
  );
}
