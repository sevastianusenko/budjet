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
 * - FAMILY_BASE: BLS CE 2024, Table 1502 "Composition of consumer unit",
 *   column "Married couple with children" (total). Used as the base when the
 *   household has children, because a family's mix differs from the all-units average.
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

/** BLS CE 2024, Table 1502: married couples with children, whole U.S. */
export const FAMILY_BASE = {
  source: "BLS Consumer Expenditure Survey, married couples with children",
  year: "2024",
  totalAnnual: 113_585,
  incomeBeforeTax: 168_471,
  persons: 4.0,
  children: 1.5,
  shares: {
    shelter: 18.1,
    utilities: 5.5,
    household: 7.0,
    food_home: 8.1,
    food_away: 5.3,
    transport_vehicle: 12.6,
    transport_gas: 4.8,
    healthcare: 7.1,
    pensions: 15.5,
    entertainment: 4.7,
    giving: 2.2,
    apparel: 2.8,
    education: 2.8,
    personal_care: 1.2,
    misc: 2.4,
  } as Record<string, number>,
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

/* ---------- A reference household sized like yours ---------- */

export interface Reference {
  profileId: string;
  /** e.g. "Philly-area family of 5 (2 adults, 3 kids)" */
  label: string;
  short: string;
  source: string;
  year: string;
  adults: number;
  children: number;
  /** Dollars a year, before taxes. */
  incomeBeforeTax: number;
  monthlyTotalCents: number;
  shares: Record<string, number>;
  estimated: string[];
  /** True when the figures are modeled from the survey rather than read off one table. */
  modeled: boolean;
  /** One sentence on how the numbers were built. */
  method: string;
}

/** OECD-modified equivalence scale: first adult 1, each further adult 0.5, each child 0.3. */
export function equivalence(adults: number, children: number): number {
  return 1 + 0.5 * Math.max(0, adults - 1) + 0.3 * Math.max(0, children);
}

/**
 * The survey average, moved to the chosen area's price level and sized to this household.
 * With children the base is the national "married couple with children" column, because a
 * family spends a different mix (more food, education and transport, less rent) than the
 * all-units average; the area's cost level is then applied as a ratio to the U.S. average.
 */
export function referenceHousehold(profile: Profile, adults: number, children: number): Reference {
  const us = PROFILES.us;
  const withKids = children > 0;
  const areaCost = profile.totalAnnual / us.totalAnnual;
  const areaIncome = profile.incomeBeforeTax / us.incomeBeforeTax;
  const base = withKids
    ? { totalAnnual: FAMILY_BASE.totalAnnual, incomeBeforeTax: FAMILY_BASE.incomeBeforeTax, persons: FAMILY_BASE.persons, children: FAMILY_BASE.children, shares: FAMILY_BASE.shares }
    : { totalAnnual: profile.totalAnnual, incomeBeforeTax: profile.incomeBeforeTax, persons: profile.persons, children: profile.children, shares: profile.shares };
  const baseAdults = Math.max(1, base.persons - base.children);
  const size = equivalence(adults, children) / equivalence(baseAdults, base.children);
  const total = base.totalAnnual * (withKids ? areaCost : 1) * size;
  const income = base.incomeBeforeTax * (withKids ? areaIncome : 1);
  const where = profile.id === "us" ? "U.S." : "Philly-area";
  const n = adults + children;
  const label = `${where} ${withKids ? "family" : "household"} of ${n} (${adults} adult${adults === 1 ? "" : "s"}${withKids ? `, ${children} kid${children === 1 ? "" : "s"}` : ""})`;
  const sized = `sized to ${adults} adult${adults === 1 ? "" : "s"}${withKids ? ` and ${children} kid${children === 1 ? "" : "s"}` : ""} (×${size.toFixed(2)})`;
  const method = withKids
    ? `Survey average for married couples with children (${FAMILY_BASE.persons} people, ${FAMILY_BASE.children} kids)${profile.id === "us" ? "" : `, moved to ${profile.short} prices (×${areaCost.toFixed(2)})`}, then ${sized}.`
    : `Survey average for the area (${profile.persons} people, ${profile.children} kids), ${sized}.`;
  return {
    profileId: profile.id,
    label,
    short: profile.short,
    source: withKids ? (profile.id === "us" ? FAMILY_BASE.source : `${FAMILY_BASE.source}; ${profile.source} price level`) : profile.source,
    year: withKids ? (profile.id === "us" ? FAMILY_BASE.year : `${FAMILY_BASE.year} / ${profile.year}`) : profile.year,
    adults,
    children,
    incomeBeforeTax: Math.round(income),
    monthlyTotalCents: Math.round((total / 12) * 100),
    shares: base.shares,
    estimated: withKids ? [] : profile.estimated,
    modeled: withKids || Math.abs(size - 1) > 0.03,
    method,
  };
}

export function refShare(ref: Reference, blsKey: string | null | undefined): number | null {
  if (!blsKey) return null;
  return ref.shares[blsKey] ?? null;
}

export function refMonthlyCents(ref: Reference, blsKey: string | null | undefined): number | null {
  const share = refShare(ref, blsKey);
  if (share === null) return null;
  return Math.round((ref.monthlyTotalCents * share) / 100);
}
