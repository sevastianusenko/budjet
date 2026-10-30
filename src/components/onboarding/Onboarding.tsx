"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame } from "lucide-react";
import { applyStarterPlan, skipOnboarding } from "@/actions/budgets";
import { DEFAULT_CATEGORIES, EMERGENCY_FUND_SHARE_PCT, TITHE_SHARE_PCT } from "@/lib/defaults";
import { fmtMoney, parseAmountToCents } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { ErrorText, Toggle } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

export function Onboarding({ name, householdName, inviteCode, done }: { name: string; householdName: string; inviteCode: string; done: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [income, setIncome] = useState("");
  const [tithe, setTithe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(done ? 2 : 1);
  const cents = parseAmountToCents(income) ?? 0;

  const preview = useMemo(() => {
    const scale = tithe ? (100 - TITHE_SHARE_PCT) / 100 : 1;
    const dollars = (pct: number) => Math.round((cents * pct * scale) / 100 / 100) * 100;
    const groups: Record<"need" | "want" | "savings", { name: string; icon: string; cents: number }[]> = { need: [], want: [], savings: [] };
    if (tithe) groups.need.push({ name: "Tithe fund (10% of every income)", icon: "Church", cents: Math.round((cents * TITHE_SHARE_PCT) / 100 / 100) * 100 });
    for (const c of DEFAULT_CATEGORIES) {
      if (c.defaultSharePct <= 0 || c.kind !== "expense" || c.group === "business" || c.group === "income") continue;
      groups[c.group as "need" | "want" | "savings"].push({ name: c.name, icon: c.icon, cents: dollars(c.defaultSharePct) });
    }
    groups.savings.push({ name: "Emergency Fund (goal)", icon: "ShieldCheck", cents: dollars(EMERGENCY_FUND_SHARE_PCT) });
    return groups;
  }, [cents, tithe]);

  if (step === 2) {
    return (
      <Shell>
        <h1 className="display text-4xl font-semibold leading-tight">You&apos;re set, {name}.</h1>
        <p className="mt-3 text-ink-2">
          {householdName} has a plan for this month and an Emergency Fund goal. Change any number later on the Plan tab.
        </p>
        <div className="mt-8 rounded-card bg-card p-5 shadow-card">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Invite your partner</p>
          <p className="num mt-2 text-center text-3xl font-semibold tracking-[0.3em]">{inviteCode}</p>
          <p className="mt-2 text-center text-sm text-ink-2">They choose &quot;Join a household&quot; at sign-up and enter this code. You can always find it in Settings.</p>
        </div>
        <Button size="lg" className="mt-8 w-full" onClick={() => router.push("/home")}>
          Open Hearth <ArrowRight size={18} />
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="display text-4xl font-semibold leading-tight">Welcome, {name}.</h1>
      <p className="mt-3 text-ink-2">
        One number sets up a sensible starting plan: what {householdName} brings home in a typical month, after taxes, everyone combined.
      </p>

      <label className="mt-8 block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Monthly take-home income</span>
        <div className="relative">
          <span className="display pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-3xl text-ink-3">$</span>
          <input
            autoFocus
            inputMode="decimal"
            value={income}
            onChange={(e) => {
              setIncome(e.target.value);
              setError(null);
            }}
            placeholder="6,500"
            className="display h-16 w-full rounded-2xl border border-line bg-card pl-10 pr-4 text-4xl font-semibold tracking-tight placeholder:text-ink-3 focus:border-green focus:outline-none"
          />
        </div>
      </label>

      <div className="mt-4 rounded-2xl border border-line px-4">
        <Toggle checked={tithe} onChange={setTithe} label="We tithe 10% of income" description="Every income you log sets 10% aside into a Tithe fund you give from; everything else scales to 90%." />
      </div>

      {cents > 0 && (
        <div className="fade-in mt-6 space-y-4">
          <p className="text-sm text-ink-2">
            Suggested plan · <span className="font-semibold text-need">50%</span> needs, <span className="font-semibold text-want">30%</span> wants,{" "}
            <span className="font-semibold text-save">20%</span> saving. Proportions follow how typical U.S. households spend. Everything is editable.
          </p>
          {(
            [
              { key: "need", label: "Needs", cls: "text-need" },
              { key: "want", label: "Wants", cls: "text-want" },
              { key: "savings", label: "Saving", cls: "text-save" },
            ] as const
          ).map((g) => (
            <div key={g.key} className="rounded-card bg-card shadow-card">
              <div className="flex items-center justify-between px-4 pt-3">
                <span className={`text-[13px] font-semibold uppercase tracking-wide ${g.cls}`}>{g.label}</span>
                <span className="num text-sm font-semibold">{fmtMoney(preview[g.key].reduce((a, r) => a + r.cents, 0), { whole: true })}</span>
              </div>
              <ul className="px-4 pb-2 pt-1">
                {preview[g.key].map((r) => (
                  <li key={r.name} className="flex items-center gap-2 py-1.5 text-sm">
                    <Icon name={r.icon} size={16} className="text-ink-3" />
                    <span className="flex-1 text-ink-2">{r.name}</span>
                    <span className="num text-ink">{fmtMoney(r.cents, { whole: true })}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="mt-4 space-y-2">
        <Button
          size="lg"
          className="w-full"
          disabled={pending || cents <= 0}
          onClick={() =>
            start(async () => {
              setStep(2);
              const res = await applyStarterPlan({ incomeCents: cents, tithe });
              if (!res.ok) {
                setStep(1);
                setError(res.error);
              }
            })
          }
        >
          Use this plan
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="w-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await skipOnboarding();
              if (!res.ok) return setError(res.error);
              router.push("/plan");
            })
          }
        >
          I&apos;ll build my own plan
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-12 pt-10">
      <div className="mb-8 flex items-center gap-2 text-green-text">
        <Flame size={22} strokeWidth={2.2} />
        <span className="display text-xl font-semibold tracking-tight text-ink">Hearth</span>
      </div>
      {children}
    </div>
  );
}
