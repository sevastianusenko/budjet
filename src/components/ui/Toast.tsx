"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface ToastOptions {
  message: string;
  tone?: "neutral" | "error";
  action?: { label: string; onClick: () => void | Promise<void> };
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<(opts: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const toast = useCallback((opts: ToastOptions) => {
    const id = ++counter.current;
    setItems((xs) => [...xs.slice(-2), { ...opts, id }]);
  }, []);

  return (
    <ToastContext value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, item.durationMs ?? (item.action ? 6000 : 3500));
    return () => clearTimeout(t);
  }, [item, onDone]);
  const tone = item.tone === "error" ? "bg-over text-white" : "bg-ink text-paper";
  return (
    <div
      role="status"
      className={`sheet-enter pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg ${tone}`}
    >
      <span>{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 font-semibold underline-offset-2 hover:underline"
          onClick={async () => {
            await item.action?.onClick();
            onDone();
          }}
        >
          {item.action.label}
        </button>
      )}
    </div>
  );
}
