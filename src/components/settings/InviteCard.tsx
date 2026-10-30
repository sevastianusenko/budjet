"use client";

import { useState, useTransition } from "react";
import { Copy, RefreshCw, Share2 } from "lucide-react";
import { regenerateInviteCode } from "@/actions/household";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function InviteCard({ code }: { code: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/join?code=${code}` : `/join?code=${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast({ message: "Invite link copied" });
    } catch {
      toast({ message: `Invite code: ${code}` });
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join our Hearth budget", text: `Join our household budget with code ${code}`, url: link });
        return;
      } catch {
        /* cancelled */
      }
    }
    copy();
  }

  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      <p className="text-[13px] font-medium text-ink-2">Invite a partner or family member</p>
      <p className="mt-1 text-xs text-ink-3">They sign up with this code and get their own login and color. Everyone sees the same budget.</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="num flex-1 rounded-xl bg-card-2 px-4 py-2.5 text-center text-xl font-semibold tracking-[0.3em]">{code}</span>
        <Button variant="secondary" size="md" onClick={copy} aria-label="Copy invite link">
          <Copy size={18} />
        </Button>
        <Button variant="secondary" size="md" onClick={share} aria-label="Share invite">
          <Share2 size={18} />
        </Button>
      </div>
      <button
        type="button"
        disabled={pending}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-ink-2"
        onClick={() => {
          if (!confirm) return setConfirm(true);
          start(async () => {
            const res = await regenerateInviteCode();
            setConfirm(false);
            toast(res.ok ? { message: "New invite code generated" } : { message: res.error, tone: "error" });
          });
        }}
      >
        <RefreshCw size={14} /> {confirm ? "Old code will stop working. Confirm?" : "Generate a new code"}
      </button>
    </div>
  );
}
