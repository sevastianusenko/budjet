"use client";

import { useState, useTransition } from "react";
import { removeMember } from "@/actions/household";
import { MemberDot } from "@/components/ui/Bits";
import { useToast } from "@/components/ui/Toast";

export function MembersList({
  members,
  meId,
  isOwner,
}: {
  members: { id: string; name: string; color: string; role: string; email: string }[];
  meId: string;
  isOwner: boolean;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <ul className="divide-y divide-line rounded-card bg-card shadow-card">
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-3 px-4 py-3">
          <MemberDot color={m.color} name={m.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">
              {m.name}
              {m.id === meId && <span className="ml-1.5 text-xs font-normal text-ink-3">(you)</span>}
            </p>
            <p className="truncate text-xs text-ink-3">
              {m.role === "owner" ? "Owner · " : ""}
              {m.email}
            </p>
          </div>
          {isOwner && m.id !== meId && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm !== m.id) return setConfirm(m.id);
                start(async () => {
                  const res = await removeMember(m.id);
                  setConfirm(null);
                  toast(res.ok ? { message: `${m.name} removed. Their entries now show under you.` } : { message: res.error, tone: "error" });
                });
              }}
              className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${confirm === m.id ? "bg-over text-white" : "text-over hover:bg-over-soft"}`}
            >
              {confirm === m.id ? "Confirm remove" : "Remove"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
