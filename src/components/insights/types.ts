import type { Insight } from "@/lib/insights";
import type { CategoryDetail } from "@/lib/details";
import type { BudgetPoint, BusinessPoint, CategoryTrend, FixedFlexPoint, GivingPoint, IncomePoint, IncomeSource, PieSlice, Rule, SubSeries, WindowKey, YearPoint, YearTotals } from "@/lib/trends";
import type { PlanBucketResult } from "@/lib/plans";
import type { BalanceSeriesPoint, KeptPoint, TrendPoint } from "./Charts";

export interface CategoryRowLite {
  id: string;
  name: string;
  icon: string;
  spent: number;
  share: number;
  vsAvg: number | null;
  avg3: number;
}

export interface CompareRow {
  key: string;
  label: string;
  /** "spend": going up is bad. "gain": going up is good. */
  kind: "spend" | "gain";
  cur: number;
  prev: number | null;
  usual: number | null;
}

export interface Mover {
  categoryId: string;
  name: string;
  icon: string;
  before: number;
  after: number;
  delta: number;
}

export interface KeptSummary {
  months: number;
  total: number;
  avg: number;
  from: string;
}

export interface Ytd {
  year: string;
  months: number;
  income: number;
  spent: number;
  toGoals: number;
  kept: number;
}

export interface ReferenceInfo {
  profileId: string;
  label: string;
  short: string;
  source: string;
  year: string;
  adults: number;
  children: number;
  incomeBeforeTax: number;
  modeled: boolean;
  method: string;
}

export interface Comparison {
  basis: "avg3" | "month";
  fullMonthCount: number;
  rows: { id: string; name: string; icon: string; you: number; typical: number; scaled: number; estimated: boolean }[];
  youTotal: number;
  typicalTotal: number;
  ref: ReferenceInfo;
}

export interface PlanView {
  id: string;
  name: string;
  author: string;
  tagline: string;
  source: string;
  buckets: PlanBucketResult[];
}

export interface CategoryTrendView extends CategoryTrend {
  subs: SubSeries[];
}

export interface BudgetByCategory {
  id: string;
  name: string;
  icon: string;
  planned: number;
  spent: number;
}

export interface InsightsData {
  month: string;
  today: string;
  currentMonth: string;
  window: WindowKey;
  /** Months in the trend window, oldest first. */
  months: string[];
  monthStatus: "past" | "current" | "future";
  dayOfMonth: number;
  daysInMonth: number;
  projectedSpend: number;
  tiles: {
    avgRate: number | null;
    rateSeries: (number | null)[];
    targetSavingsShare: number;
    fullMonthCount: number;
    efMonths: number | null;
    fixedShare: number | null;
    ytd: Ytd;
    balanceNow: number;
    goalsCount: number;
  };
  insights: Insight[];
  trend: TrendPoint[];
  kept: KeptPoint[];
  keptSummary: KeptSummary | null;
  balances: BalanceSeriesPoint[];
  forecast: { month: string; total: number }[];
  goalTarget: number;
  goals: { id: string; name: string; icon: string; isEmergency: boolean }[];
  efEta: string | null;
  categoryTrends: CategoryTrendView[];
  fixedFlex: FixedFlexPoint[];
  income: { points: IncomePoint[]; sources: IncomeSource[] };
  budget: { points: BudgetPoint[]; byCategory: BudgetByCategory[] };
  year: { points: YearPoint[]; totals: YearTotals; prev: YearTotals | null };
  compare: { prevMonth: string | null; prevLabel: string; rows: CompareRow[]; movers: Mover[] };
  categoryRows: CategoryRowLite[];
  totalSpent: number;
  pie: PieSlice[];
  details: CategoryDetail[];
  comparison: Comparison;
  rules: Rule[];
  plans: PlanView[];
  planMonths: number;
  planIncome: number;
  giving: { points: GivingPoint[]; totals: { setAside: number; given: number; income: number }; tithePct: number } | null;
  business: { points: BusinessPoint[]; totals: { income: number; expenses: number; net: number }; topSubs: { name: string; total: number }[]; year: string } | null;
}
