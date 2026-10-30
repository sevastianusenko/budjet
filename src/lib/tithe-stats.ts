import type { GoalLite, TxLite } from "./calc";
import { inMonth, goalProgress } from "./calc";
import type { ISODate, Month } from "./dates";

export interface TitheStats {
  goalId: string;
  balance: number;
  setAsideMonth: number;
  givenMonth: number;
  givenYear: number;
  /** Where the fund money went this month, by category / subcategory label. */
  byLabelMonth: { label: string; cents: number }[];
  byLabelYear: { label: string; cents: number }[];
}

/** Balance and flows of the Tithe fund. Giving = negative fund entries, labelled by their category. */
export function titheStats(
  goal: GoalLite,
  txs: TxLite[],
  today: ISODate,
  month: Month,
  labelFor: (categoryId: string | null, subcategoryId: string | null) => string,
): TitheStats {
  const mine = txs.filter((t) => t.type === "goal" && t.goalId === goal.id);
  const year = month.slice(0, 4);
  const given = mine.filter((t) => t.amountCents < 0);
  const group = (rows: TxLite[]) => {
    const map = new Map<string, number>();
    for (const t of rows) {
      const label = labelFor(t.categoryId, t.subcategoryId);
      map.set(label, (map.get(label) ?? 0) - t.amountCents);
    }
    return [...map.entries()].map(([label, cents]) => ({ label, cents })).sort((a, b) => b.cents - a.cents);
  };
  const givenMonthRows = given.filter((t) => inMonth(t, month));
  const givenYearRows = given.filter((t) => t.date.startsWith(year));
  return {
    goalId: goal.id,
    balance: goalProgress(goal, txs, today).saved,
    setAsideMonth: mine.filter((t) => t.amountCents > 0 && inMonth(t, month)).reduce((a, t) => a + t.amountCents, 0),
    givenMonth: -givenMonthRows.reduce((a, t) => a + t.amountCents, 0),
    givenYear: -givenYearRows.reduce((a, t) => a + t.amountCents, 0),
    byLabelMonth: group(givenMonthRows),
    byLabelYear: group(givenYearRows),
  };
}
