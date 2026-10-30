"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ChartNoAxesColumn, House, List, PiggyBank, Plus, Table2 } from "lucide-react";
import { ToastProvider } from "@/components/ui/Toast";
import { AddTransactionSheet, type EditableTx, type SheetDefaults } from "@/components/add/AddTransactionSheet";
import type { Group } from "@/lib/calc";

export interface ShellMember {
  id: string;
  name: string;
  color: string;
}
export interface ShellCategory {
  id: string;
  name: string;
  icon: string;
  kind: "expense" | "income";
  group: Group;
  archived: boolean;
  /** Number of entries in recent history, for ordering tiles by habit. */
  uses: number;
}
export interface ShellSubcategory {
  id: string;
  categoryId: string;
  name: string;
  archived: boolean;
  uses: number;
}
export interface ShellGoal {
  id: string;
  name: string;
  icon: string;
  archived: boolean;
  isTithe: boolean;
}
export interface ShellTitheFund {
  id: string;
  /** Current fund balance in cents. */
  balance: number;
}

interface AddSheetApi {
  openNew: (defaults?: SheetDefaults) => void;
  openEdit: (tx: EditableTx) => void;
}

const AddSheetContext = createContext<AddSheetApi>({ openNew: () => {}, openEdit: () => {} });
export const useAddSheet = () => useContext(AddSheetContext);

const TABS = [
  { href: "/home", label: "Home", icon: House },
  { href: "/activity", label: "Activity", icon: List },
  { href: "/plan", label: "Plan", icon: Table2 },
  { href: "/goals", label: "Goals", icon: PiggyBank },
  { href: "/insights", label: "Insights", icon: ChartNoAxesColumn },
];

export function AppShell({
  me,
  members,
  categories,
  subcategories,
  goals,
  titheFund,
  tithePct,
  today,
  children,
}: {
  me: ShellMember;
  members: ShellMember[];
  categories: ShellCategory[];
  subcategories: ShellSubcategory[];
  goals: ShellGoal[];
  titheFund: ShellTitheFund | null;
  tithePct: number;
  today: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<{ open: boolean; defaults?: SheetDefaults; edit?: EditableTx }>({ open: false });

  const api = useMemo<AddSheetApi>(
    () => ({
      openNew: (defaults) => setSheet({ open: true, defaults }),
      openEdit: (tx) => setSheet({ open: true, edit: tx }),
    }),
    [],
  );
  const close = useCallback(() => setSheet((s) => ({ ...s, open: false })), []);

  return (
    <ToastProvider>
      <AddSheetContext value={api}>
        <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
          <main className="flex-1 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] pt-2">{children}</main>
        </div>

        <button
          type="button"
          onClick={() => api.openNew()}
          aria-label="Add entry"
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green text-green-ink shadow-[0_10px_30px_-8px_rgb(31_95_76/0.7)] transition-transform active:scale-95 sm:right-[calc(50%-15rem)]"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>

        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur">
          <ul className="mx-auto flex max-w-lg items-stretch justify-around">
            {TABS.map((t) => {
              const active = pathname === t.href || pathname.startsWith(t.href + "/");
              const I = t.icon;
              return (
                <li key={t.href} className="flex-1">
                  <Link
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                      active ? "text-green-text" : "text-ink-3 hover:text-ink-2"
                    }`}
                  >
                    <I size={22} strokeWidth={active ? 2.4 : 1.8} />
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <AddTransactionSheet
          open={sheet.open}
          onClose={close}
          me={me}
          members={members}
          categories={categories}
          subcategories={subcategories}
          goals={goals}
          titheFund={titheFund}
          tithePct={tithePct}
          today={today}
          defaults={sheet.defaults}
          edit={sheet.edit}
        />
      </AddSheetContext>
    </ToastProvider>
  );
}
