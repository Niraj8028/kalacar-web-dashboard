import { useEffect, useRef } from "react";

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
