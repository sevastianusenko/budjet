"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Bottom sheet on phones, centered dialog on wider screens.
 * Sheets are always closed on the server render, so the portal only ever runs in the browser.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button aria-label="Close" className="fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="sheet-enter relative flex max-h-[94dvh] w-full max-w-md flex-col rounded-t-[28px] bg-card shadow-sheet sm:max-h-[88dvh] sm:rounded-[28px]"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
        {title !== undefined && (
          <div className="flex items-center justify-between px-5 pb-1 pt-3">
            <h2 className="display text-xl font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:bg-card-2"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe shrink-0 border-t border-line px-5 pb-4 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
