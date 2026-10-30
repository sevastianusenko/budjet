import type { GoalProgress, MonthSummary } from "./calc";
import { fmtMoney, fmtPct } from "./money";
import { shortDate } from "./dates";

export interface Insight {
  id: string;
  tone: "good" | "watch" | "act" | "info";
  title: string;
  body: string;
  href?: string;
}

interface Ctx {
  summary: MonthSummary;
  goals: GoalProgress[];
  emergencyMonths: number | null;
  catName: (id: string) => string;
}

/** Plain-language, rule-based observations. Ordered by usefulness; take the first N. */
export function buildInsights({ summary: s, goals, emergencyMonths, catName }: Ctx): Insight[] {
  const out: Insight[] = [];
  const cur = s.status === "current";

  if (s.mode === "cashflow" && cur) {
    out.push({
      id: "no-plan",
      tone: "act",
      title: "No plan for this month yet",
      body: "Safe to spend is just income minus spending right now. Set planned amounts to get a number you can trust.",
      href: "/plan",
    });
  }

  if (s.mode === "plan" && cur && s.plannedExpenses > 0) {
    const diff = s.projectedSpend - (s.plannedExpenses + s.plannedSavingsCategories);
    const pressure = [...s.rows].filter((r) => r.remaining < 0 || r.pace === "ahead").sort((a, b) => a.remaining - b.remaining)[0];
    if (diff > 2000) {
      out.push({
        id: "proj-over",
        tone: "watch",
        title: `On pace to end ${fmtMoney(diff, { whole: true })} over plan`,
        body: pressure
          ? `${pressure.cat.name} is the main pressure: ${fmtMoney(pressure.spent, { whole: true })} of ${fmtMoney(pressure.available, { whole: true })} used.`
          : "Spending speed over the last two weeks is higher than the plan allows.",
        href: "/plan",
      });
    } else if (s.dayOfMonth >= 7) {
      out.push({
        id: "proj-under",
        tone: "good",
        title: `On track · projected ${fmtMoney(Math.abs(diff), { whole: true })} ${diff <= 0 ? "under" : "over"} plan`,
        body: `${fmtMoney(s.spent, { whole: true })} spent so far, with ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} to go.`,
      });
    }
  }

  const over = s.rows.filter((r) => r.pace === "over" && r.available > 0).sort((a, b) => a.remaining - b.remaining);
  if (over.length) {
    const r = over[0];
    out.push({
      id: `over-${r.cat.id}`,
      tone: "act",
      title: `${r.cat.name} is over by ${fmtMoney(-r.remaining, { whole: true })}`,
      body:
        over.length > 1
          ? `${over.length} categories are over plan. Move money from one with room, or raise the plan.`
          : "Cover it from a category with room left, or adjust the plan so the number stays honest.",
      href: "/plan",
    });
  }

  const ahead = s.rows.filter((r) => r.pace === "ahead" && r.spent > 5000).sort((a, b) => b.spent / Math.max(1, b.expectedByToday) - a.spent / Math.max(1, a.expectedByToday));
  if (ahead.length && cur) {
    const r = ahead[0];
    out.push({
      id: `ahead-${r.cat.id}`,
      tone: "watch",
      title: `${r.cat.name} is moving fast`,
      body: `${fmtMoney(r.spent, { whole: true })} spent by day ${s.dayOfMonth}; an even pace would be about ${fmtMoney(r.expectedByToday, { whole: true })}.`,
    });
  }

  const spiking = s.rows
    .filter((r) => r.vsAvg !== null && r.vsAvg > 0.25 && r.spent > 5000 && !r.cat.isFixed)
    .sort((a, b) => (b.vsAvg ?? 0) - (a.vsAvg ?? 0));
  if (spiking.length) {
    const r = spiking[0];
    out.push({
      id: `spike-${r.cat.id}`,
      tone: "watch",
      title: `${r.cat.name} is ${fmtPct(r.vsAvg ?? 0)} above your usual`,
      body: `Your 3-month average is ${fmtMoney(r.avg3, { whole: true })}; this month is at ${fmtMoney(r.spent, { whole: true })}.`,
    });
  }

  if (s.unassigned !== null && s.expectedIncome > 0) {
    if (s.unassigned < 0) {
      out.push({
        id: "overallocated",
        tone: "act",
        title: `Plans exceed income by ${fmtMoney(-s.unassigned, { whole: true })}`,
        body: "Every dollar should have one job. Trim a category or a goal contribution until this reaches zero.",
        href: "/plan",
      });
    } else if (s.unassigned > s.expectedIncome * 0.05) {
      out.push({
        id: "unassigned",
        tone: "info",
        title: `${fmtMoney(s.unassigned, { whole: true })} of income has no job yet`,
        body: "Unassigned money tends to get spent. Give it to a goal or a sinking fund before the month does.",
        href: "/goals",
      });
    }
  }

  if (emergencyMonths !== null) {
    if (emergencyMonths < 3) {
      out.push({
        id: "ef-low",
        tone: emergencyMonths < 1 ? "act" : "watch",
        title: `Emergency fund covers ${emergencyMonths.toFixed(1)} month${emergencyMonths.toFixed(1) === "1.0" ? "" : "s"} of essentials`,
        body: "Most planners suggest 3 to 6 months. Even $50 a month moves this number.",
        href: "/goals",
      });
    } else {
      out.push({
        id: "ef-ok",
        tone: "good",
        title: `Emergency fund covers ${emergencyMonths.toFixed(1)} months`,
        body: "That's inside the 3 to 6 month range planners recommend.",
      });
    }
  } else if (!goals.some((g) => g.goal.isEmergency)) {
    out.push({
      id: "ef-none",
      tone: "info",
      title: "No emergency fund yet",
      body: "A cushion of 3 months of essential spending is the first goal most experts recommend.",
      href: "/goals",
    });
  }

  const noSpend = s.byDay.filter((d) => d.date <= s.today && d.spent === 0).length;
  const spendDays = s.byDay.filter((d) => d.count > 0).length;
  if (cur && s.dayOfMonth >= 5 && noSpend >= 3 && spendDays >= 3) {
    const biggest = [...s.byDay].sort((a, b) => b.spent - a.spent)[0];
    out.push({
      id: "nospend",
      tone: "good",
      title: `${noSpend} no-spend day${noSpend === 1 ? "" : "s"} this month`,
      body: biggest?.spent ? `Biggest day was ${shortDate(biggest.date)} at ${fmtMoney(biggest.spent, { whole: true })}.` : "Keep the streak going.",
    });
  }

  if (s.status === "past" && s.savingsRate !== null) {
    const target = s.split.savings.targetShare;
    const ok = s.savingsRate >= target;
    out.push({
      id: "rate",
      tone: ok ? "good" : "watch",
      title: `Savings rate ${fmtPct(s.savingsRate)} · target ${fmtPct(target)}`,
      body: ok
        ? `You kept ${fmtMoney(s.income - s.needWantSpent, { whole: true })} of ${fmtMoney(s.income, { whole: true })} income.`
        : `Needs and wants used ${fmtPct(1 - s.savingsRate)} of income. Wants are usually the easiest place to find room.`,
    });
  }

  const behind = goals.filter((g) => g.monthlyNeeded !== null && g.goal.monthlyPlanCents > 0 && (g.monthlyNeeded ?? 0) > g.goal.monthlyPlanCents * 1.1 && !g.done);
  if (behind.length) {
    const g = behind[0];
    out.push({
      id: `goal-${g.goal.id}`,
      tone: "watch",
      title: `${g.goal.name} needs ${fmtMoney(g.monthlyNeeded ?? 0, { whole: true })}/mo to hit its date`,
      body: `The plan is ${fmtMoney(g.goal.monthlyPlanCents, { whole: true })}/mo. Raise it or move the deadline.`,
      href: "/goals",
    });
  }

  void catName;
  return out;
}
