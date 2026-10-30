"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Tells the server which timezone "today" should be computed in.
 * Stored as a plain cookie; refreshed when it changes (travel, new device).
 */
export function TimezoneCookie() {
  const router = useRouter();
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      const current = document.cookie
        .split("; ")
        .find((c) => c.startsWith("tz="))
        ?.split("=")[1];
      if (current !== encodeURIComponent(tz)) {
        document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }
    } catch {
      /* ignore */
    }
  }, [router]);
  return null;
}
