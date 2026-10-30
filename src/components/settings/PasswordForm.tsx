"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/actions/household";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export function PasswordForm() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-card bg-card px-4 py-3.5 text-left text-[15px] font-medium shadow-card hover:bg-card-2/60">
        Change password
      </button>
    );
  return (
    <form
      className="space-y-3 rounded-card bg-card p-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const res = await changePassword({ current: String(f.get("current") ?? ""), next: String(f.get("next") ?? "") });
          if (!res.ok) return setError(res.error);
          setOpen(false);
          toast({ message: "Password changed" });
        });
      }}
    >
      <Field label="Current password">
        <Input name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <Input name="next" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          Update password
        </Button>
      </div>
    </form>
  );
}
