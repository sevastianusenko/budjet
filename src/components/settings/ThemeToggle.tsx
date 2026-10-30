"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";

export type ThemeChoice = "auto" | "light" | "dark";

const OPTIONS: { id: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { id: "auto", label: "Auto", icon: SunMoon },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

function readTheme(): ThemeChoice {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "auto";
}

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** Applies the choice to the document immediately and remembers it in a cookie for the server. */
function applyTheme(t: ThemeChoice) {
  const root = document.documentElement;
  if (t === "auto") delete root.dataset.theme;
  else root.dataset.theme = t;
  document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((l) => l());
}

/** Per-device appearance: follows the phone's setting, or forces light / dark. Stored in a cookie so the server renders it without a flash. */
export function ThemeToggle() {
  const router = useRouter();
  const current = useSyncExternalStore(subscribe, readTheme, () => "auto" as ThemeChoice);

  function choose(t: ThemeChoice) {
    applyTheme(t);
    router.refresh();
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 rounded-card bg-card p-1.5 shadow-card">
      {OPTIONS.map((o) => {
        const I = o.icon;
        const active = current === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(o.id)}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors ${active ? "bg-green-soft text-green-text" : "text-ink-2 hover:bg-card-2"}`}
          >
            <I size={18} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
