"use client";

import { useState, useTransition } from "react";
import { setTitheBalance } from "@/actions/goals";
import { centsToInput, fmtMoney, parseAmountToCents } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

/** Sets the Tithe fund to what is really there; the difference lands in the fund's starting amount. */
export function TitheAdjustSheet({ open, onClose, goalId, balance }: { open: boolean; onClose: () => void; goalId: string; balance: number }) {
  if (!open) return null;
  return <AdjustForm onClose={onClose} goalId={goalId} balance={balance} />;
}

function AdjustForm({ onClose, goalId, balance }: { onClose: () => void; goalId: string; balance: number }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(centsToInput(Math.max(0, balance)));
  const [error, setError] = useState<string | null>(null);
  const cents = parseAmountToCents(value);
  const delta = cents === null ? null : cents - balance;

  function submit() {
    if (cents === null || delta === null) return setError("Enter the amount that is in the fund.");
    start(async () => {
      const res = await setTitheBalance({ goalId, balanceCents: cents });
      if (!res.ok) return setError(res.error);
      onClose();
      toast({ message: `Fund set to ${fmtMoney(cents, { whole: true })} (${fmtMoney(delta, { whole: true, signed: true })})` });
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Adjust the Tithe fund"
      footer={
        <Button className="w-full" size="lg" onClick={submit} disabled={pending || cents === null || delta === 0}>
          Set balance
        </Button>
      }
    >
      <div className="space-y-4 pb-2 pt-1">
        <p className="text-sm text-ink-2">
          Hearth shows <span className="num font-semibold text-ink">{fmtMoney(balance, { whole: true })}</span> in the fund. Type what is really there, for example after counting the envelope or checking the account.
        </p>
        <Field label="Actual balance" hint="Only the fund's starting amount moves. Every set-aside and gift in your history stays as logged.">
          <Input inputMode="decimal" className="num" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
        </Field>
        {delta !== null && delta !== 0 && (
          <p className={`text-sm font-medium ${delta > 0 ? "text-green-text" : "text-over"}`}>
            {delta > 0 ? `${fmtMoney(delta, { whole: true })} will be added to the fund.` : `${fmtMoney(-delta, { whole: true })} will be taken out of the fund.`}
          </p>
        )}
        {cents === null && value.trim() !== "" && <p className="text-sm text-over">That doesn&apos;t look like an amount.</p>}
        <p className="text-xs text-ink-3">Gave cash and forgot to log it? Add it as &quot;Gave to church&quot; with the right date instead, so the giving totals stay true.</p>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
