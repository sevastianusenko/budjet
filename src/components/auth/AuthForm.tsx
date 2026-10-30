"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorText, Field, Input } from "@/components/ui/Field";
import { joinHousehold, signIn, signUp, type ActionResult } from "@/actions/auth";

type Mode = "login" | "signup" | "join";

const COPY: Record<Mode, { title: string; lead: string; cta: string }> = {
  login: { title: "Welcome back", lead: "Sign in to your household budget.", cta: "Sign in" },
  signup: { title: "Start your household", lead: "One shared budget. Everyone gets their own login and color.", cta: "Create household" },
  join: { title: "Join a household", lead: "Use the 6-character invite code from your partner's Settings.", cta: "Join" },
};

export function AuthForm({ mode, inviteCode }: { mode: Mode; inviteCode?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const copy = COPY[mode];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    start(async () => {
      let res: ActionResult;
      if (mode === "login") res = await signIn(data);
      else if (mode === "signup") res = await signUp(data);
      else res = await joinHousehold(data);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="fade-in">
      <h1 className="display text-4xl font-semibold leading-tight">{copy.title}</h1>
      <p className="mt-2 text-ink-2">{copy.lead}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {mode !== "login" && (
          <Field label="Your first name">
            <Input name="name" autoComplete="given-name" required placeholder="Sam" />
          </Field>
        )}
        {mode === "signup" && (
          <Field label="Household name" hint="Shows at the top of the shared budget.">
            <Input name="householdName" required placeholder="The Parkers" />
          </Field>
        )}
        {mode === "join" && (
          <Field label="Invite code">
            <Input
              name="inviteCode"
              required
              defaultValue={inviteCode}
              placeholder="ABC234"
              maxLength={6}
              className="num uppercase tracking-[0.3em]"
              autoCapitalize="characters"
            />
          </Field>
        )}
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required inputMode="email" placeholder="you@example.com" />
        </Field>
        <Field label="Password" hint={mode === "login" ? undefined : "At least 8 characters."}>
          <Input
            name="password"
            type="password"
            required
            minLength={mode === "login" ? 1 : 8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "One moment…" : copy.cta}
        </Button>
      </form>

      <div className="mt-8 space-y-2 text-center text-sm text-ink-2">
        {mode !== "login" && (
          <p>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-green-text underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        )}
        {mode !== "signup" && (
          <p>
            New here?{" "}
            <Link href="/signup" className="font-medium text-green-text underline-offset-2 hover:underline">
              Start a household
            </Link>
          </p>
        )}
        {mode !== "join" && (
          <p>
            Have an invite code?{" "}
            <Link href="/join" className="font-medium text-green-text underline-offset-2 hover:underline">
              Join a household
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
