"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteHousehold } from "@/actions/household";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Field";

/** Owner-only: wipe the household. Needs the household name typed back. */
export function DangerZone({ householdName }: { householdName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-card bg-card px-4 py-3.5 text-left text-[15px] font-medium text-over shadow-card hover:bg-over-soft/40">
        Delete this household…
      </button>
    );

  return (
    <div className="space-y-3 rounded-card border border-over/40 bg-card p-4 shadow-card">
      <p className="text-sm text-ink-2">
        This removes <strong className="font-semibold text-ink">{householdName}</strong> for everyone: all members, entries, plans, goals and bills. There is no undo. Export a CSV first if you want a copy.
      </p>
      <Field label={`Type “${householdName}” to confirm`}>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Field>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          className="flex-1"
          disabled={pending || typed.trim() !== householdName.trim()}
          onClick={() =>
            start(async () => {
              const res = await deleteHousehold(typed);
              if (res && !res.ok) setError(res.error);
            })
          }
        >
          <Trash2 size={18} /> Delete household
        </Button>
      </div>
    </div>
  );
}
