import Link from "next/link";
import type { Category, Goal, Subcategory, Transaction } from "@/db/schema";
import { SectionTitle, Empty } from "@/components/ui/Bits";
import { TxRow } from "@/components/activity/TxRow";
import type { ItemLite } from "@/lib/items";

export function RecentActivity({
  txs,
  members,
  categories,
  subcategories,
  goals,
  itemsByTx = {},
  today,
  month,
}: {
  txs: Transaction[];
  members: { id: string; name: string; color: string }[];
  categories: Category[];
  subcategories: Subcategory[];
  goals: Goal[];
  itemsByTx?: Record<string, ItemLite[]>;
  today: string;
  month: string;
}) {
  return (
    <section>
      <SectionTitle
        action={
          <Link href={`/activity?m=${month}`} className="text-[13px] font-medium text-green-text">
            All activity
          </Link>
        }
      >
        Recent
      </SectionTitle>
      {txs.length === 0 ? (
        <Empty title="Nothing logged this month yet" body="Tap + to add your first expense or income. It takes three taps." />
      ) : (
        <ul className="divide-y divide-line rounded-card bg-card shadow-card">
          {txs.map((t) => (
            <TxRow key={t.id} tx={t} members={members} categories={categories} subcategories={subcategories} goals={goals} items={itemsByTx[t.id]} today={today} showDate />
          ))}
        </ul>
      )}
    </section>
  );
}
