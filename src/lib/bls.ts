/**
 * U.S. Bureau of Labor Statistics, Consumer Expenditures 2024 (all consumer units).
 * Share of total annual spending ($78,535) by category.
 * Source: https://www.bls.gov/opub/reports/consumer-expenditures/2024/
 */
export const BLS_YEAR = 2024;
export const BLS_TOTAL_SPEND = 78_535;
export const BLS_INCOME_BEFORE_TAX = 104_207;

export const BLS_SHARES: Record<string, { label: string; sharePct: number }> = {
  shelter: { label: "Shelter (rent / mortgage)", sharePct: 20.8 },
  utilities: { label: "Utilities & phone", sharePct: 6.0 },
  household: { label: "Household supplies & furnishings", sharePct: 6.6 },
  food_home: { label: "Groceries", sharePct: 7.9 },
  food_away: { label: "Dining out", sharePct: 5.0 },
  transport_vehicle: { label: "Car payments & insurance", sharePct: 12.2 },
  transport_gas: { label: "Gas & transit", sharePct: 4.8 },
  healthcare: { label: "Healthcare", sharePct: 7.9 },
  pensions: { label: "Retirement & insurance", sharePct: 12.5 },
  entertainment: { label: "Entertainment", sharePct: 4.6 },
  giving: { label: "Gifts & giving", sharePct: 2.9 },
  apparel: { label: "Clothing", sharePct: 2.5 },
  education: { label: "Education & childcare", sharePct: 2.0 },
  personal_care: { label: "Personal care", sharePct: 1.2 },
  misc: { label: "Everything else", sharePct: 2.6 },
};

export function blsShare(key: string | null | undefined): number | null {
  if (!key) return null;
  return BLS_SHARES[key]?.sharePct ?? null;
}
