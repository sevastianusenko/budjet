import type { CatLite, Group } from "./calc";

/**
 * Well-known budget plans, expressed as buckets with a recommended share of take-home income.
 * Each bucket says which Hearth categories feed it: by survey key, by default category name,
 * by group, or whatever is left ("rest"). Business categories stay out of every plan.
 */
export interface Matcher {
  bls?: string[];
  names?: string[];
  groups?: Group[];
  /** Narrow a "want" group match to fixed (subscriptions) or flexible wants. */
  wants?: "fixed" | "flexible";
  /** Add net contributions to savings goals (tithe fund excluded). */
  goals?: boolean;
  /** Add tithe set-asides. */
  tithe?: boolean;
  /** Catch every expense category no earlier bucket claimed. */
  rest?: boolean;
}

export interface PlanBucket {
  id: string;
  label: string;
  /** Recommended share of income as fractions; null = the plan gives no number. */
  min: number | null;
  max: number | null;
  /** Being under the minimum is a miss (giving, saving); for spending buckets only "over" is flagged. */
  floor?: boolean;
  note: string;
  match: Matcher;
}

export interface FamousPlan {
  id: string;
  name: string;
  author: string;
  tagline: string;
  source: string;
  buckets: PlanBucket[];
}

export const PLANS: FamousPlan[] = [
  {
    id: "ramsey",
    name: "Dave Ramsey's budget percentages",
    author: "Dave Ramsey (Ramsey Solutions)",
    tagline: "Give first, keep housing under a quarter of take-home pay, attack debt.",
    source: "ramseysolutions.com/budgeting/budget-percentages. Housing ≤ 25%, giving 10% and ~5% misc are stated on the page; the other ranges are the classic Ramsey guideline percentages. Of take-home pay.",
    buckets: [
      { id: "giving", label: "Giving", min: 0.1, max: 0.1, floor: true, note: "Tithe and gifts. Ramsey: give 10% first.", match: { bls: ["giving"], tithe: true } },
      { id: "saving", label: "Saving & investing", min: 0.1, max: 0.15, floor: true, note: "10% while paying off debt, 15% of gross into retirement once debt-free.", match: { groups: ["savings"], goals: true } },
      { id: "housing", label: "Housing", min: null, max: 0.25, note: "Rent or mortgage with tax, insurance, HOA. No more than 25% of take-home pay.", match: { bls: ["shelter"] } },
      { id: "utilities", label: "Utilities", min: 0.05, max: 0.1, note: "Electric, gas, water, phone, internet.", match: { bls: ["utilities"] } },
      { id: "food", label: "Food", min: 0.1, max: 0.15, note: "Groceries and restaurants together.", match: { bls: ["food_home", "food_away"] } },
      { id: "transport", label: "Transportation", min: null, max: 0.1, note: "Car payment, insurance, gas, transit.", match: { bls: ["transport_vehicle", "transport_gas"] } },
      { id: "health", label: "Health", min: 0.05, max: 0.1, note: "Medical, dental, prescriptions.", match: { bls: ["healthcare"] } },
      { id: "insurance", label: "Insurance", min: 0.1, max: 0.25, note: "Life, home, disability. Only if you track it as its own category.", match: { names: ["Insurance"] } },
      { id: "childcare", label: "Childcare & school", min: null, max: null, note: "No set percent; Ramsey lists it as its own line.", match: { bls: ["education"] } },
      { id: "debt", label: "Debt payments", min: null, max: null, note: "No percent on purpose: every spare dollar goes here until it is gone.", match: { names: ["Debt Payments"] } },
      { id: "recreation", label: "Recreation", min: 0.05, max: 0.1, note: "Entertainment, travel, subscriptions.", match: { bls: ["entertainment"], names: ["Travel", "Subscriptions"] } },
      { id: "personal", label: "Personal spending", min: 0.05, max: 0.1, note: "Clothes, personal care, fun money.", match: { bls: ["apparel", "personal_care"], names: ["Fun Money"] } },
      { id: "misc", label: "Miscellaneous", min: null, max: 0.1, note: "Home supplies, kids & pets, everything else. About 5–10%.", match: { rest: true } },
    ],
  },
  {
    id: "sethi",
    name: "Conscious Spending Plan",
    author: "Ramit Sethi, I Will Teach You to Be Rich",
    tagline: "Automate fixed costs and investing, then spend the rest without guilt.",
    source: "I Will Teach You to Be Rich (2nd ed., 2019) and iwillteachyoutoberich.com. Shares of take-home pay.",
    buckets: [
      { id: "fixed", label: "Fixed costs", min: 0.5, max: 0.6, note: "Rent, utilities, insurance, car, groceries, debt payments, subscriptions, tithe.", match: { groups: ["need"], wants: "fixed", tithe: true } },
      { id: "invest", label: "Investments", min: 0.1, max: 0.1, floor: true, note: "Retirement accounts and investing, before anything else.", match: { groups: ["savings"] } },
      { id: "savings", label: "Savings goals", min: 0.05, max: 0.1, floor: true, note: "Emergency fund, vacations, big purchases.", match: { goals: true } },
      { id: "guiltfree", label: "Guilt-free spending", min: 0.2, max: 0.35, note: "Dining out, fun, travel, clothes: whatever is left after the above.", match: { groups: ["want"], wants: "flexible", rest: true } },
    ],
  },
  {
    id: "warren",
    name: "50/30/20",
    author: "Elizabeth Warren & Amelia Warren Tyagi, All Your Worth",
    tagline: "Half for needs, a third for wants, a fifth for the future.",
    source: "All Your Worth (2005). Shares of take-home pay. This is also the check on your Plan tab, with your own targets.",
    buckets: [
      { id: "needs", label: "Needs", min: null, max: 0.5, note: "Housing, food, utilities, transport, insurance, minimum debt payments, tithe.", match: { groups: ["need"], tithe: true } },
      { id: "wants", label: "Wants", min: null, max: 0.3, note: "Everything you could live without.", match: { groups: ["want"], rest: true } },
      { id: "savings", label: "Savings & debt payoff", min: 0.2, max: null, floor: true, note: "Goals, retirement and extra debt payments.", match: { groups: ["savings"], goals: true } },
    ],
  },
];

export function getPlan(id: string | null | undefined): FamousPlan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export interface PlanTotals {
  income: number;
  /** Spent per expense category over the window. */
  byCategory: Record<string, number>;
  /** Net contributions to savings goals (tithe fund excluded). */
  goalContributions: number;
  titheSetAside: number;
}

export interface PlanBucketResult {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
  note: string;
  amount: number;
  /** Share of income, or null without income. */
  share: number | null;
  status: "in" | "over" | "under" | "none";
  /** Category names that landed in this bucket, for the detail line. */
  categories: string[];
}

function matches(m: Matcher, c: CatLite): boolean {
  if (m.bls && c.blsKey && m.bls.includes(c.blsKey)) return true;
  if (m.names && m.names.includes(c.name)) return true;
  if (m.groups && m.groups.includes(c.group)) {
    if (c.group === "want" && m.wants) return m.wants === "fixed" ? c.isFixed : !c.isFixed;
    return true;
  }
  return false;
}

/** Puts every expense category (business excluded) into exactly one bucket, first match wins, "rest" catches the remainder. */
export function comparePlan(plan: FamousPlan, cats: CatLite[], t: PlanTotals): { buckets: PlanBucketResult[]; income: number } {
  const amounts = new Map<string, number>(plan.buckets.map((b) => [b.id, 0]));
  const names = new Map<string, string[]>(plan.buckets.map((b) => [b.id, []]));
  const rest = plan.buckets.find((b) => b.match.rest);
  for (const c of cats) {
    if (c.kind !== "expense" || c.group === "business") continue;
    const spent = t.byCategory[c.id] ?? 0;
    if (spent === 0) continue;
    const bucket = plan.buckets.find((b) => !b.match.rest && matches(b.match, c)) ?? rest;
    if (!bucket) continue;
    amounts.set(bucket.id, (amounts.get(bucket.id) ?? 0) + spent);
    names.get(bucket.id)!.push(c.name);
  }
  for (const b of plan.buckets) {
    if (b.match.goals) amounts.set(b.id, (amounts.get(b.id) ?? 0) + t.goalContributions);
    if (b.match.tithe) amounts.set(b.id, (amounts.get(b.id) ?? 0) + t.titheSetAside);
  }
  const buckets = plan.buckets.map((b) => {
    const amount = amounts.get(b.id) ?? 0;
    const share = t.income > 0 ? amount / t.income : null;
    let status: PlanBucketResult["status"] = "none";
    if (share !== null && (b.min !== null || b.max !== null)) {
      if (b.max !== null && share > b.max + 0.005) status = "over";
      else if (b.floor && b.min !== null && share < b.min - 0.005) status = "under";
      else status = "in";
    }
    return { id: b.id, label: b.label, min: b.min, max: b.max, note: b.note, amount, share, status, categories: names.get(b.id) ?? [] };
  });
  return { buckets, income: t.income };
}
