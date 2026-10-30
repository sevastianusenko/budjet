"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { markBillPaid } from "@/actions/recurring";
import { useToast } from "@/components/ui/Toast";

export function MarkPaidButton({ billId, month }: { billId: string; month: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await markBillPaid(billId, month);
          toast(res.ok ? { message: "Marked paid" } : { message: res.error, tone: "error" });
        })
      }
      className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line-strong px-2 text-xs font-semibold text-ink-2 hover:bg-card-2 disabled:opacity-50"
    >
      <Check size={14} />
      Paid
    </button>
  );
}
