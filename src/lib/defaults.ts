import type { Group } from "./calc";

export interface DefaultCategory {
  name: string;
  icon: string;
  kind: "expense" | "income";
  group: Group;
  isFixed: boolean;
  rollover: boolean;
  blsKey: string | null;
  /** Share of monthly take-home used by the starter plan (percent). Sums to 50 / 30 / 10 (+10 for the emergency goal). */
  defaultSharePct: number;
}

/**
 * Starter categories for a U.S. household. Shares follow 50/30/20 and the
 * proportions of the BLS Consumer Expenditure Survey.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Needs — 50
  { name: "Rent / Mortgage", icon: "House", kind: "expense", group: "need", isFixed: true, rollover: false, blsKey: "shelter", defaultSharePct: 26 },
  { name: "Utilities & Phone", icon: "Zap", kind: "expense", group: "need", isFixed: true, rollover: false, blsKey: "utilities", defaultSharePct: 5 },
  { name: "Groceries", icon: "ShoppingCart", kind: "expense", group: "need", isFixed: false, rollover: false, blsKey: "food_home", defaultSharePct: 8 },
  { name: "Gas & Transit", icon: "Fuel", kind: "expense", group: "need", isFixed: false, rollover: false, blsKey: "transport_gas", defaultSharePct: 3 },
  { name: "Car Payment & Insurance", icon: "Car", kind: "expense", group: "need", isFixed: true, rollover: false, blsKey: "transport_vehicle", defaultSharePct: 5 },
  { name: "Health & Medical", icon: "HeartPulse", kind: "expense", group: "need", isFixed: false, rollover: true, blsKey: "healthcare", defaultSharePct: 2 },
  { name: "Home & Supplies", icon: "SprayCan", kind: "expense", group: "need", isFixed: false, rollover: false, blsKey: "household", defaultSharePct: 1 },
  { name: "Childcare & School", icon: "Baby", kind: "expense", group: "need", isFixed: true, rollover: false, blsKey: "education", defaultSharePct: 0 },
  { name: "Debt Payments", icon: "CreditCard", kind: "expense", group: "need", isFixed: true, rollover: false, blsKey: null, defaultSharePct: 0 },
  { name: "Tithe", icon: "Church", kind: "expense", group: "need", isFixed: true, rollover: false, blsKey: "giving", defaultSharePct: 0 },
  // Wants — 30
  { name: "Dining Out", icon: "UtensilsCrossed", kind: "expense", group: "want", isFixed: false, rollover: false, blsKey: "food_away", defaultSharePct: 7 },
  { name: "Entertainment", icon: "Clapperboard", kind: "expense", group: "want", isFixed: false, rollover: false, blsKey: "entertainment", defaultSharePct: 4 },
  { name: "Shopping & Clothing", icon: "ShoppingBag", kind: "expense", group: "want", isFixed: false, rollover: false, blsKey: "apparel", defaultSharePct: 5 },
  { name: "Subscriptions", icon: "Tv", kind: "expense", group: "want", isFixed: true, rollover: false, blsKey: null, defaultSharePct: 2 },
  { name: "Travel", icon: "Plane", kind: "expense", group: "want", isFixed: false, rollover: true, blsKey: null, defaultSharePct: 4 },
  { name: "Personal Care", icon: "Sparkles", kind: "expense", group: "want", isFixed: false, rollover: false, blsKey: "personal_care", defaultSharePct: 2 },
  { name: "Gifts & Giving", icon: "Gift", kind: "expense", group: "want", isFixed: false, rollover: true, blsKey: "giving", defaultSharePct: 3 },
  { name: "Fun Money", icon: "PartyPopper", kind: "expense", group: "want", isFixed: false, rollover: false, blsKey: null, defaultSharePct: 3 },
  { name: "Kids & Pets", icon: "PawPrint", kind: "expense", group: "want", isFixed: false, rollover: false, blsKey: null, defaultSharePct: 0 },
  // Savings — 10 (the other 10 goes to the Emergency Fund goal)
  { name: "Retirement & Investing", icon: "TrendingUp", kind: "expense", group: "savings", isFixed: true, rollover: false, blsKey: "pensions", defaultSharePct: 10 },
  // Parking spot for imports that couldn't decide; sorted later on /sort. Counts as a want until then.
  { name: "Uncategorized", icon: "CircleHelp", kind: "expense", group: "want", isFixed: false, rollover: false, blsKey: null, defaultSharePct: 0 },
  // Business — tracked apart from the 50/30/20 split
  { name: "Business", icon: "Store", kind: "expense", group: "business", isFixed: false, rollover: false, blsKey: null, defaultSharePct: 0 },
  // Income
  { name: "Paycheck", icon: "Banknote", kind: "income", group: "income", isFixed: false, rollover: false, blsKey: null, defaultSharePct: 0 },
  { name: "Side Income", icon: "Briefcase", kind: "income", group: "income", isFixed: false, rollover: false, blsKey: null, defaultSharePct: 0 },
  { name: "Business Income", icon: "Store", kind: "income", group: "income", isFixed: false, rollover: false, blsKey: null, defaultSharePct: 0 },
  { name: "Other Income", icon: "Coins", kind: "income", group: "income", isFixed: false, rollover: false, blsKey: null, defaultSharePct: 0 },
];

/**
 * Starter subcategories, keyed by default category name. Rename "Car 1" to the
 * actual car, add a child or a credit card: they're just labels under the category.
 */
export const DEFAULT_SUBCATEGORIES: Record<string, string[]> = {
  "Rent / Mortgage": ["Rent / mortgage", "HOA & fees", "Property tax"],
  "Utilities & Phone": ["Electric", "Gas / heating", "Water & sewer", "Internet", "Phone", "Trash"],
  Groceries: ["Meat & fish", "Vegetables & fruit", "Dairy & eggs", "Bread & bakery", "Prepared foods", "Snacks & drinks"],
  "Gas & Transit": ["Car 1", "Car 2", "Parking & tolls", "Transit & rideshare"],
  "Car Payment & Insurance": ["Car 1 payment", "Car 2 payment", "Insurance", "Repairs & maintenance"],
  "Health & Medical": ["Doctor & copays", "Pharmacy", "Dental", "Vision"],
  "Home & Supplies": ["Cleaning & supplies", "Repairs & maintenance", "Furniture & decor"],
  "Childcare & School": ["Daycare", "School fees", "Supplies & books"],
  "Debt Payments": ["Credit card 1", "Credit card 2", "Student loan", "Other loan"],
  "Dining Out": ["Restaurants", "Takeout & delivery", "Coffee & snacks"],
  Entertainment: ["Movies & events", "Hobbies", "Games"],
  "Shopping & Clothing": ["Clothes & shoes", "Electronics", "Home goods"],
  Subscriptions: ["Streaming", "Software & apps", "Memberships"],
  "Gifts & Giving": ["Gifts", "Charity"],
  Tithe: ["Church", "Helping someone", "Missions"],
  "Kids & Pets": ["Activities & sports", "Clothes & gear", "Pets"],
  Business: ["Websites", "Auto repair", "Supplies & tools", "Fees & other"],
};

/** Share of take-home that the starter plan sends to the Emergency Fund goal each month. */
export const EMERGENCY_FUND_SHARE_PCT = 10;
/** Starter emergency target: months of essential (needs) spending. */
export const EMERGENCY_FUND_MONTHS = 3;
/** Share of take-home for the tithe when the household tithes. */
export const TITHE_SHARE_PCT = 10;

/** Member colors: distinct on white and on dark paper (validated for color-vision deficiency). */
export const MEMBER_COLORS = [
  "#E0533F", // coral
  "#7C4DD4", // violet
  "#1A9FB0", // teal
  "#C4871A", // amber
  "#D6478A", // pink
  "#3A6FD8", // blue
  "#5E8F1A", // olive
  "#8E4A6B", // plum
];

export const CATEGORY_ICONS = [
  "House", "Zap", "ShoppingCart", "Fuel", "Car", "HeartPulse", "SprayCan", "Baby", "CreditCard", "Church",
  "UtensilsCrossed", "Clapperboard", "ShoppingBag", "Tv", "Plane", "Sparkles", "Gift", "PartyPopper",
  "PawPrint", "TrendingUp", "Banknote", "Briefcase", "Store", "Coins", "Coffee", "Dumbbell", "GraduationCap",
  "Shirt", "Wrench", "Bus", "Pill", "Phone", "Wifi", "Droplets", "Flame", "Book", "Music", "Gamepad2",
  "Bike", "Trees", "Hammer", "Stethoscope", "Scissors", "Dog", "Cat", "Pizza", "Wine", "Laptop", "Globe", "CircleHelp", "Tag",
] as const;

export const GOAL_ICONS = [
  "PiggyBank", "ShieldCheck", "Plane", "Car", "House", "GraduationCap", "Gift", "Heart", "Laptop",
  "Baby", "Palmtree", "Bike", "Sofa", "Wrench", "Sparkles", "Target",
] as const;
