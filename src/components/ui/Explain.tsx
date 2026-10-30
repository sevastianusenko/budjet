"use client";

import { useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Sheet } from "./Sheet";

/** "How is this calculated?" — a small question mark that opens a plain-language explanation. */
export function Explain({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`How is ${title} calculated?`}
        className="-mr-1 flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:bg-card-2 hover:text-ink-2"
      >
        <CircleHelp size={17} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`How ${title.toLowerCase()} works`}>
        <div className="space-y-3 pb-6 text-[15px] leading-relaxed text-ink-2">{children}</div>
      </Sheet>
    </>
  );
}
