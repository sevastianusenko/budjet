/**
 * Reference households to compare spending with. Shares are percent of total
 * annual spending, keyed by a category's `blsKey`.
 *
 * Sources:
 * - "us": BLS Consumer Expenditure Survey 2024, all consumer units.
 *   https://www.bls.gov/opub/reports/consumer-expenditures/2024/
 * - "philadelphia": BLS Consumer Expenditures, Philadelphia-Camden-Wilmington area,
 *   2023–24 two-year average (release 26-9-PHI, Jan 2026).
 *   https://www.bls.gov/regions/mid-atlantic/news-release/ConsumerExpenditures_Philadelphia.htm
 *   The release gives housing and transportation only as totals; their sub-splits
 *   below use the national proportions and are marked as estimates.
 */
export interface Profile {
  id: string;
  label: string;
  short: string;
  source: string;
  year: string;
  /** Average annual spending per household, dollars. */
  totalAnnual: number;
  /** Average income before taxes, dollars. */
  incomeBeforeTax: number;
  persons: number;
  children: number;
  shares: Record<string, number>;
  /** blsKeys whose share is derived rather than published. */
  estimated: string[];
}

export const PROFILES: Record<string, Profile> = {
  us: {
    id: "us",
    label: "Average U.S. household",
    short: "U.S. avg",
    source: "BLS Consumer Expenditure Survey",
    year: "2024",
    totalAnnual: 78_535,
    incomeBeforeTax: 104_207,
    persons: 2.4,
    children: 0.6,
    shares: {
      shelter: 20.8,
      utilities: 6.0,
      household: 6.6,
      food_home: 7.9,
      food_away: 5.0,
      transport_vehicle: 12.2,
      transport_gas: 4.8,
      healthcare: 7.9,
      pensions: 12.5,
      entertainment: 4.6,
      giving: 2.9,
      apparel: 2.5,
      education: 2.0,
      personal_care: 1.2,
      misc: 2.6,
    },
    estimated: [],
  },
  philadelphia: {
    id: "philadelphia",
    label: "Philadelphia-area household (PA/NJ/DE)",
    short: "Philly avg",
    source: "BLS Consumer Expenditures, Philadelphia area",
    year: "2023–24",
    totalAnnual: 92_234,
    incomeBeforeTax: 141_142,
    persons: 2.6,
    children: 0.7,
    shares: {
      // housing 34.5 total, split by national proportions
      shelter: 21.5,
      utilities: 6.2,
      household: 6.8,
      // food 13.1 total; at home 58.3% / away 41.7% of food
      food_home: 7.6,
      food_away: 5.5,
      // transportation 14.1 total, split by national proportions
      transport_vehicle: 10.1,
      transport_gas: 4.0,
      healthcare: 7.1,
      pensions: 14.3,
      entertainment: 4.4,
      giving: 2.9,
      apparel: 2.4,
      education: 3.1,
      personal_care: 1.1,
      misc: 2.8,
    },
    estimated: ["shelter", "utilities", "household", "transport_vehicle", "transport_gas", "misc"],
  },
};

export const DEFAULT_PROFILE = "us";

export function getProfile(id: string | null | undefined): Profile {
  return PROFILES[id ?? ""] ?? PROFILES[DEFAULT_PROFILE];
}

export function profileShare(profile: Profile, blsKey: string | null | undefined): number | null {
  if (!blsKey) return null;
  return profile.shares[blsKey] ?? null;
}

/** Typical monthly dollars (cents) a reference household spends on a category key. */
export function profileMonthlyCents(profile: Profile, blsKey: string | null | undefined): number | null {
  const share = profileShare(profile, blsKey);
  if (share === null) return null;
  return Math.round(((profile.totalAnnual * share) / 100 / 12) * 100);
}
