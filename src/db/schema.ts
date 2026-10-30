import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const households = pgTable("households", {
  id: id(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  needsPct: integer("needs_pct").notNull().default(50),
  wantsPct: integer("wants_pct").notNull().default(30),
  savingsPct: integer("savings_pct").notNull().default(20),
  /** Planned monthly take-home income, in cents. 0 = not set. */
  expectedIncomeCents: integer("expected_income_cents").notNull().default(0),
  /** Which reference household to compare spending with (see lib/profiles.ts). */
  comparisonProfile: text("comparison_profile").notNull().default("us"),
  /** Percent of every income set aside into the Tithe fund automatically. 0 = off. */
  tithePct: integer("tithe_pct").notNull().default(0),
  /** Set once the owner finished (or skipped) onboarding. */
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    /** Member color, hex like #E0533F. Shown on every entry this user makes. */
    color: text("color").notNull(),
    role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const categories = pgTable(
  "categories",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** lucide icon name, e.g. "ShoppingCart" */
    icon: text("icon").notNull().default("Tag"),
    kind: text("kind", { enum: ["expense", "income"] }).notNull(),
    /** 50/30/20 bucket. Income categories use "income"; "business" is tracked apart from the split. */
    group: text("group", { enum: ["need", "want", "savings", "income", "business"] }).notNull(),
    /** Fixed bills (rent, insurance) vs. variable spending (groceries). */
    isFixed: boolean("is_fixed").notNull().default(false),
    /** Carry positive leftover into next month (sinking fund behaviour). */
    rollover: boolean("rollover").notNull().default(false),
    /** Key into the BLS comparison table, or null. */
    blsKey: text("bls_key"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
  },
  (t) => [index("categories_household_idx").on(t.householdId)],
);

/** Optional detail under a category: which car, which child, which card, what kind of groceries. */
export const subcategories = pgTable(
  "subcategories",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
  },
  (t) => [index("subcategories_category_idx").on(t.categoryId)],
);

export const budgets = pgTable(
  "budgets",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    /** "YYYY-MM" */
    month: text("month").notNull(),
    plannedCents: integer("planned_cents").notNull().default(0),
  },
  (t) => [
    uniqueIndex("budgets_category_month_idx").on(t.categoryId, t.month),
    index("budgets_household_month_idx").on(t.householdId, t.month),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("PiggyBank"),
    targetCents: integer("target_cents").notNull(),
    /** Planned contribution per month, in cents. */
    monthlyPlanCents: integer("monthly_plan_cents").notNull().default(0),
    /** "YYYY-MM-DD" or null */
    deadline: text("deadline"),
    isEmergency: boolean("is_emergency").notNull().default(false),
    /** The Tithe fund: filled by automatic set-asides from income, drawn down by giving. */
    isTithe: boolean("is_tithe").notNull().default(false),
    /** Money already saved before tracking started, in cents. */
    startingCents: integer("starting_cents").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goals_household_idx").on(t.householdId)],
);

export const recurring = pgTable(
  "recurring",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** 1..31, clamped to the month length when due. */
    dayOfMonth: integer("day_of_month").notNull(),
    type: text("type", { enum: ["expense", "income"] }).notNull().default("expense"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recurring_household_idx").on(t.householdId)],
);

/** A receipt imported as a whole: its lines are transactions, its item details are receipt_items. */
export const receipts = pgTable(
  "receipts",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    store: text("store").notNull().default(""),
    date: text("date").notNull(),
    totalCents: integer("total_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("receipts_household_date_idx").on(t.householdId, t.date)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    /** Who entered / paid. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    subcategoryId: text("subcategory_id").references(() => subcategories.id, { onDelete: "set null" }),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    recurringId: text("recurring_id").references(() => recurring.id, { onDelete: "set null" }),
    /** For automatic entries (a tithe set-aside): the income entry that produced it. */
    parentId: text("parent_id"),
    /** Set when the entry is one line of an imported receipt. */
    receiptId: text("receipt_id").references(() => receipts.id, { onDelete: "set null" }),
    /** Groups the rows of one CSV import so the whole batch can be undone. */
    importBatch: text("import_batch"),
    type: text("type", { enum: ["expense", "income", "goal"] }).notNull(),
    /** Cents. Positive. For type "goal" a negative value is a withdrawal. */
    amountCents: integer("amount_cents").notNull(),
    /** "YYYY-MM-DD" as chosen on the device, no timezone math. */
    date: text("date").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_household_date_idx").on(t.householdId, t.date),
    index("transactions_household_category_idx").on(t.householdId, t.categoryId),
    index("transactions_parent_idx").on(t.parentId),
    index("transactions_import_batch_idx").on(t.importBatch),
  ],
);

/** What exactly was bought in one entry: "Chicken thighs, 3.2 lb @ 2.99/lb = 9.57". */
export const receiptItems = pgTable(
  "receipt_items",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Quantity in `unit` (3.2 lb, 4 each), null when the receipt didn't say. */
    qty: real("qty"),
    unit: text("unit"),
    /** Price per unit in cents, null when unknown. */
    unitPriceCents: integer("unit_price_cents"),
    amountCents: integer("amount_cents").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("receipt_items_transaction_idx").on(t.transactionId)],
);

export type Household = typeof households.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
export type ReceiptItem = typeof receiptItems.$inferSelect;
export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Recurring = typeof recurring.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
