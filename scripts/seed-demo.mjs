// Fills a household with ~4 months of realistic demo data so charts and insights
// have something to show. Safe to run more than once (it skips if demo data exists).
//
//   node scripts/seed-demo.mjs sam@hearth.test
//
// Uses DATABASE_URL when set, otherwise the local PGlite database in ./.data/pg
// (stop `npm run dev` first in that case: PGlite is single-process).
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const email = (process.argv[2] ?? "").toLowerCase();
if (!email) {
  console.error("Usage: node scripts/seed-demo.mjs <owner email>");
  process.exit(1);
}

/* ------------------------------ db adapter ------------------------------ */
let q, close;
if (process.env.DATABASE_URL) {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);
  q = (text, params = []) => sql.query(text, params);
  close = async () => {};
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.join(process.cwd(), ".data", "pg");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  q = async (text, params = []) => (await client.query(text, params)).rows;
  close = () => client.close();
}

/* ------------------------------ helpers --------------------------------- */
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const between = (lo, hi) => Math.round(lo + rand() * (hi - lo));
const pad = (n) => String(n).padStart(2, "0");
const uuid = () => crypto.randomUUID();
const today = new Date();
const curMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
const todayISO = `${curMonth}-${pad(today.getDate())}`;
const addMonths = (m, n) => {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
};
const daysIn = (m) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};
const dateIn = (m, d) => `${m}-${pad(Math.min(d, daysIn(m)))}`;

/* ------------------------------ load household --------------------------- */
const [owner] = await q(`select * from users where email = $1`, [email]);
if (!owner) {
  console.error(`No user with email ${email}. Sign up in the app first.`);
  await close();
  process.exit(1);
}
const hid = owner.household_id;
const cats = await q(`select * from categories where household_id = $1`, [hid]);
const cat = (name) => {
  const c = cats.find((x) => x.name === name);
  if (!c) throw new Error(`Category "${name}" not found; the seed expects the default categories.`);
  return c.id;
};

const existing = await q(`select count(*)::int as n from goals where household_id = $1 and name = 'Summer road trip'`, [hid]);
if (existing[0].n > 0) {
  console.log("Demo data already present (found the demo goal). Nothing to do.");
  await close();
  process.exit(0);
}

/* ------------------------------ second member ---------------------------- */
let [partner] = await q(`select * from users where household_id = $1 and id <> $2 order by created_at limit 1`, [hid, owner.id]);
if (!partner) {
  const hash = await bcrypt.hash("hearth-test-123", 12);
  [partner] = await q(
    `insert into users (id, household_id, email, password_hash, name, color, role) values ($1,$2,$3,$4,$5,$6,'member') returning *`,
    [uuid(), hid, "alex@hearth.test", hash, "Alex", "#7C4DD4"],
  );
  console.log("Added demo member Alex (alex@hearth.test / hearth-test-123).");
}

/* ------------------------------ budgets for past months ------------------ */
const curBudgets = await q(`select * from budgets where household_id = $1 and month = $2`, [hid, curMonth]);
for (let i = 1; i <= 3; i++) {
  const m = addMonths(curMonth, -i);
  for (const b of curBudgets) {
    await q(
      `insert into budgets (id, household_id, category_id, month, planned_cents) values ($1,$2,$3,$4,$5) on conflict (category_id, month) do nothing`,
      [uuid(), hid, b.category_id, m, b.planned_cents],
    );
  }
}

/* ------------------------------ recurring bills -------------------------- */
const bills = [
  { name: "Rent", cat: "Rent / Mortgage", amount: 169000, day: 1 },
  { name: "Electric + Internet", cat: "Utilities & Phone", amount: 32500, day: 5 },
  { name: "Car payment + insurance", cat: "Car Payment & Insurance", amount: 32500, day: 10 },
  { name: "Streaming + phone plans", cat: "Subscriptions", amount: 13000, day: 3 },
];
const billIds = {};
const existingBills = await q(`select * from recurring where household_id = $1`, [hid]);
for (const b of bills) {
  const found = existingBills.find((x) => x.name === b.name);
  if (found) {
    billIds[b.name] = found.id;
    continue;
  }
  const [row] = await q(
    `insert into recurring (id, household_id, category_id, name, amount_cents, day_of_month, type, active) values ($1,$2,$3,$4,$5,$6,'expense',true) returning id`,
    [uuid(), hid, cat(b.cat), b.name, b.amount, b.day],
  );
  billIds[b.name] = row.id;
}

/* ------------------------------ goal ------------------------------------- */
let [goal] = await q(`select * from goals where household_id = $1 and is_emergency = true`, [hid]);
if (!goal) {
  [goal] = await q(
    `insert into goals (id, household_id, name, icon, target_cents, monthly_plan_cents, is_emergency) values ($1,$2,'Emergency Fund','ShieldCheck',975000,65000,true) returning *`,
    [uuid(), hid],
  );
}
let [vacation] = await q(`select * from goals where household_id = $1 and name = 'Summer road trip'`, [hid]);
if (!vacation) {
  const deadline = `${addMonths(curMonth, 8)}-01`;
  [vacation] = await q(
    `insert into goals (id, household_id, name, icon, target_cents, monthly_plan_cents, deadline, starting_cents) values ($1,$2,'Summer road trip','Palmtree',240000,20000,$3,30000) returning *`,
    [uuid(), hid, deadline],
  );
}

/* ------------------------------ transactions ----------------------------- */
const rows = [];
const add = (type, user, date, amount, { categoryId = null, goalId = null, recurringId = null, note = "" } = {}) =>
  rows.push([uuid(), hid, user, categoryId, goalId, recurringId, type, amount, date, note]);

const months = [3, 2, 1, 0].map((i) => addMonths(curMonth, -i));
for (const m of months) {
  const isCur = m === curMonth;
  const lastDay = isCur ? today.getDate() : daysIn(m);
  const d = (day) => dateIn(m, day);
  const inRange = (day) => day <= lastDay;

  // Income: two paychecks
  if (inRange(1)) add("income", owner.id, d(1), 325000, { categoryId: cat("Paycheck"), note: "paycheck" });
  if (inRange(15)) add("income", owner.id, d(15), 325000, { categoryId: cat("Paycheck"), note: "paycheck" });
  if (m !== months[0] && inRange(20) && rand() > 0.5) add("income", partner.id, d(20), between(15000, 42000), { categoryId: cat("Side Income"), note: "freelance" });

  // Bills (owner pays), linked to recurring so they show as paid
  for (const b of bills) {
    if (inRange(b.day)) add("expense", owner.id, d(b.day), b.amount, { categoryId: cat(b.cat), recurringId: billIds[b.name], note: b.name });
  }
  if (inRange(2)) add("expense", owner.id, d(2), 65000, { categoryId: cat("Retirement & Investing"), note: "401k" });

  // Goals
  if (inRange(2)) add("goal", owner.id, d(2), 65000, { goalId: goal.id, note: "emergency fund" });
  if (inRange(16)) add("goal", partner.id, d(16), 20000, { goalId: vacation.id, note: "road trip" });

  // Groceries: weekly, mostly partner
  for (const day of [2, 6, 9, 13, 16, 20, 23, 27, 30]) {
    if (!inRange(day)) continue;
    const who = rand() > 0.3 ? partner.id : owner.id;
    add("expense", who, d(day), between(4200, 16500), { categoryId: cat("Groceries"), note: rand() > 0.5 ? "Trader Joe's" : "Costco" });
  }
  // Gas
  for (const day of [4, 14, 24]) if (inRange(day)) add("expense", rand() > 0.5 ? owner.id : partner.id, d(day), between(4100, 7200), { categoryId: cat("Gas & Transit"), note: "gas" });
  // Dining out: a few times
  for (const day of [3, 7, 11, 12, 18, 21, 25, 28]) {
    if (!inRange(day) || rand() > 0.72) continue;
    add("expense", rand() > 0.5 ? owner.id : partner.id, d(day), between(1800, 8900), { categoryId: cat("Dining Out"), note: rand() > 0.5 ? "takeout" : "dinner out" });
  }
  // Entertainment, shopping, personal care, fun money, gifts, health
  if (inRange(8)) add("expense", partner.id, d(8), between(2400, 6500), { categoryId: cat("Entertainment"), note: "movies" });
  if (inRange(19) && rand() > 0.4) add("expense", owner.id, d(19), between(3000, 9000), { categoryId: cat("Entertainment"), note: "concert" });
  if (inRange(11)) add("expense", partner.id, d(11), between(4500, 14500), { categoryId: cat("Shopping & Clothing"), note: "Target" });
  if (inRange(26) && rand() > 0.5) add("expense", owner.id, d(26), between(3000, 12000), { categoryId: cat("Shopping & Clothing"), note: "Amazon" });
  if (inRange(17)) add("expense", partner.id, d(17), between(3500, 6000), { categoryId: cat("Personal Care"), note: "haircut" });
  if (inRange(6)) add("expense", owner.id, d(6), between(2000, 6000), { categoryId: cat("Fun Money"), note: "" });
  if (inRange(22)) add("expense", partner.id, d(22), between(2000, 6000), { categoryId: cat("Fun Money"), note: "" });
  if (inRange(13) && rand() > 0.6) add("expense", owner.id, d(13), between(3000, 12000), { categoryId: cat("Gifts & Giving"), note: "birthday gift" });
  if (inRange(9) && rand() > 0.5) add("expense", partner.id, d(9), between(2500, 9500), { categoryId: cat("Health & Medical"), note: "copay" });
  if (inRange(15)) add("expense", owner.id, d(15), between(2500, 6500), { categoryId: cat("Home & Supplies"), note: "supplies" });
}

for (const r of rows) {
  await q(
    `insert into transactions (id, household_id, user_id, category_id, goal_id, recurring_id, type, amount_cents, date, note) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    r,
  );
}
await q(`update households set onboarded_at = coalesce(onboarded_at, now()), expected_income_cents = case when expected_income_cents = 0 then 650000 else expected_income_cents end where id = $1`, [hid]);

console.log(`Seeded ${rows.length} entries across ${months[0]} … ${curMonth} (today ${todayISO}).`);
await close();
