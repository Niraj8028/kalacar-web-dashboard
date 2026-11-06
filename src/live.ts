import { useEffect, useRef, useState } from "react";
import { isLiveConnected, useLiveRevision } from "./realtime";

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
 * Goes up by one when any order changed. Live signals do the work; this slow check catches a missed
 * signal and asks Razorpay about recent unpaid orders. It runs faster only if live updates are down.
 */
export function useOrderChanges(enabled: boolean) {
  const signalled = useLiveRevision(enabled, "orders");
  const [checked, setChecked] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let stamp: string | null = null;
    let lastCheck = 0;
    const check = async () => {
      lastCheck = Date.now();
      try {
        const response = await fetch("/api/admin/orders/changes", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { stamp?: string };
        if (!active || !data.stamp) return;
        if (stamp !== null && data.stamp !== stamp) setChecked(current => current + 1);
        stamp = data.stamp;
      } catch { /* The next check tries again. */ }
    };
    const onMessage = (event: MessageEvent<{ type?: string }>) => { if (event.data?.type === "kalacar-orders-changed") void check(); };
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    void check();
    const timer = window.setInterval(() => { if (Date.now() - lastCheck >= (isLiveConnected() ? 60000 : 15000)) void check(); }, 5000);
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); navigator.serviceWorker?.removeEventListener("message", onMessage); };
  }, [enabled]);
  return signalled + checked;
}
