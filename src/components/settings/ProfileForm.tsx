"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateProfile } from "@/actions/household";
import { MEMBER_COLORS } from "@/lib/defaults";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export function ProfileForm(props: { name: string; color: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(props.name);
  const [color, setColor] = useState(props.color);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4 rounded-card bg-card p-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateProfile({ name, color });
          if (!res.ok) return setError(res.error);
          toast({ message: "Profile saved" });
        });
      }}
    >
      <Field label="Your name">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </Field>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Your color</span>
        <p className="mb-2 text-xs text-ink-3">Marks every entry you make so the family can see who logged what.</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Member color">
          {MEMBER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-card transition-transform active:scale-95"
              style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px var(--card), 0 0 0 4px ${c}` : undefined }}
            >
              {color === c && <Check size={18} strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        Save profile
      </Button>
    </form>
  );
}
