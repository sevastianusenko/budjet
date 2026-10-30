"use client";

import { useState, useTransition } from "react";
import { updateHousehold } from "@/actions/household";
import { centsToInput, parseAmountToCents } from "@/lib/money";
import { PROFILES } from "@/lib/profiles";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export function HouseholdForm(props: {
  name: string;
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
  expectedIncomeCents: number;
  comparisonProfile: string;
  tithePct: number;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(props.name);
  const [income, setIncome] = useState(props.expectedIncomeCents ? centsToInput(props.expectedIncomeCents) : "");
  const [needs, setNeeds] = useState(props.needsPct);
  const [wants, setWants] = useState(props.wantsPct);
  const [savings, setSavings] = useState(props.savingsPct);
  const [profile, setProfile] = useState(props.comparisonProfile);
  const [tithe, setTithe] = useState(props.tithePct);
  const [error, setError] = useState<string | null>(null);
  const sum = needs + wants + savings;
  const chosen = PROFILES[profile];

  return (
    <form
      className="space-y-4 rounded-card bg-card p-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await updateHousehold({
            name,
            needsPct: needs,
            wantsPct: wants,
            savingsPct: savings,
            expectedIncomeCents: income.trim() ? parseAmountToCents(income) ?? 0 : 0,
            comparisonProfile: profile,
            tithePct: tithe,
          });
          if (!res.ok) return setError(res.error);
          toast({ message: "Household saved" });
        });
      }}
    >
      <Field label="Household name">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </Field>
      <Field label="Planned monthly take-home income" hint="Combined, after taxes. Drives Safe to spend, To assign, and the 50/30/20 check.">
        <Input inputMode="decimal" className="num" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="6,500" />
      </Field>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Targets · needs / wants / saving</span>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: needs, set: setNeeds, label: "Needs", cls: "text-need" },
            { v: wants, set: setWants, label: "Wants", cls: "text-want" },
            { v: savings, set: setSavings, label: "Saving", cls: "text-save" },
          ].map((f) => (
            <label key={f.label} className="block">
              <span className={`mb-1 block text-xs font-semibold ${f.cls}`}>{f.label}</span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={f.v}
                  onChange={(e) => f.set(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  className="num h-11 w-full rounded-xl border border-line bg-card px-3 pr-7 text-[16px] focus:border-green focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">%</span>
              </div>
            </label>
          ))}
        </div>
        <p className={`mt-1.5 text-xs ${sum === 100 ? "text-ink-3" : "text-over"}`}>
          {sum === 100 ? "Adds up to 100%. The classic rule is 50/30/20; 60/20/20 fits high-rent areas." : `Adds up to ${sum}%. Make it 100%.`}
        </p>
      </div>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Tithe · set aside from every income</span>
        <div className="relative w-32">
          <input
            type="number"
            min={0}
            max={50}
            value={tithe}
            onChange={(e) => setTithe(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
            className="num h-11 w-full rounded-xl border border-line bg-card px-3 pr-7 text-[16px] focus:border-green focus:outline-none"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">%</span>
        </div>
        <p className="mt-1.5 text-xs text-ink-3">
          {tithe > 0
            ? `Every income you log moves ${tithe}% into the Tithe fund. Giving to church or helping someone comes out of the fund; the balance is always visible on Home and Goals.`
            : "0% = off. Set 10% to reserve a tenth of every income in a Tithe fund you give from."}
        </p>
      </div>
      <Field label="Compare our spending with" hint={chosen ? `${chosen.source}, ${chosen.year}. Average of ${chosen.persons} people per household.` : undefined}>
        <Select value={profile} onChange={(e) => setProfile(e.target.value)}>
          {Object.values(PROFILES).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={pending || sum !== 100} className="w-full">
        Save household
      </Button>
    </form>
  );
}
