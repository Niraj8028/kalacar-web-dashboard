import { useEffect, useRef, useState } from "react";

/**
 * Runs `load` now and every `everyMs` while the dashboard tab is visible. Polling pauses while the
 * tab is hidden and runs at once when the owner comes back, so new orders show up without a reload.
 */
export function useLiveRefresh(load: () => unknown, everyMs: number, deps: unknown[], enabled = true) {
  const latest = useRef(load);
  useEffect(() => { latest.current = load; });
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const run = () => { void latest.current(); };
    const start = () => {
      window.clearInterval(timer);
      if (document.visibilityState !== "visible") return;
      run();
      timer = window.setInterval(run, everyMs);
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", start); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyMs, enabled, ...deps]);
}

/**
 * Asks the server every 5 seconds whether any order changed, and goes up by one when one has.
 * A browser alert makes it check at once. Every order view reloads from this one number.
 */
export function useOrderChanges(enabled: boolean) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let stamp: string | null = null;
    const check = async () => {
      try {
        const response = await fetch("/api/admin/orders/changes", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { stamp?: string };
        if (!active || !data.stamp) return;
        if (stamp !== null && data.stamp !== stamp) setRevision(current => current + 1);
        stamp = data.stamp;
      } catch { /* The next check tries again. */ }
    };
    const onMessage = (event: MessageEvent<{ type?: string }>) => { if (event.data?.type === "kalacar-orders-changed") void check(); };
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    void check();
    const timer = window.setInterval(() => void check(), 5000);
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); navigator.serviceWorker?.removeEventListener("message", onMessage); };
  }, [enabled]);
  return revision;
}
