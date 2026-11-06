import { useEffect, useRef, useState } from "react";
import { StatusChip } from "./dashboard-ui";

// New-order sound and count for the owner dashboard. Everything here stays in this browser.
const SOUND_KEY = "kalacar_owner_order_sound";
const PLAYED_KEY = "kalacar_owner_order_sound_played";
const SOUND_EVENT = "kalacar-owner-order-sound";
const CHANNEL = "kalacar_owner_orders";
const POLL_MS = 10000;
const PAID_LABELS = new Set(["Paid", "Paid after cancel"]);

function readStorage(key: string) { try { return window.localStorage.getItem(key); } catch { return null; } }
function writeStorage(key: string, value: string) { try { window.localStorage.setItem(key, value); } catch { /* Alerts still work without storage. */ } }
const soundIsOn = () => readStorage(SOUND_KEY) !== "off";

let audio: AudioContext | null = null;
function audioContext() {
  if (!audio && typeof AudioContext !== "undefined") audio = new AudioContext();
  return audio;
}
const soundAllowed = () => audioContext()?.state === "running";

function playChime() {
  const context = audioContext();
  if (!context) return;
  [[660, 0], [880, 0.18]].forEach(([frequency, delay]) => {
    const start = context.currentTime + delay;
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.frequency.value = frequency;
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    tone.connect(volume).connect(context.destination);
    tone.start(start);
    tone.stop(start + 0.4);
  });
}

/** Plays once across open tabs: the first tab that can make a sound claims these orders. */
async function chimeOnce(ids: string[]) {
  const claim = () => {
    let played: string[] = [];
    try { played = JSON.parse(readStorage(PLAYED_KEY) ?? "[]") as string[]; } catch { played = []; }
    if (!ids.some(id => !played.includes(id))) return;
    writeStorage(PLAYED_KEY, JSON.stringify([...played, ...ids].slice(-100)));
    playChime();
  };
  if (navigator.locks) await navigator.locks.request(PLAYED_KEY, claim);
  else claim();
}

/** Counts paid orders that arrive while the dashboard is open. Orders that already existed don't count. */
export function useOrderAlerts(enabled: boolean, viewingOrders: boolean) {
  const [newIds, setNewIds] = useState<string[]>([]);
  const [soundOn, setSoundOn] = useState(soundIsOn);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const viewing = useRef(viewingOrders);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!enabled) { setNewIds([]); return; }
    let active = true;
    let seen: Set<string> | null = null;
    const isViewing = () => viewing.current && !document.hidden;
    const poll = async () => {
      try {
        const response = await fetch("/api/admin/orders?status=all", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { orders?: { id: string; status: string }[] };
        if (!active || !data.orders) return;
        const paid = data.orders.filter(order => PAID_LABELS.has(order.status)).map(order => order.id);
        if (!seen) { seen = new Set(paid); return; }
        const fresh = paid.filter(id => !seen?.has(id));
        if (!fresh.length) return;
        fresh.forEach(id => seen?.add(id));
        if (!isViewing()) setNewIds(current => [...current, ...fresh]);
        if (soundIsOn() && soundAllowed()) await chimeOnce(fresh);
      } catch { /* The next check tries again; Orders shows its own connection error. */ }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, [enabled]);

  // Browsers keep a page silent until someone clicks or types on it.
  useEffect(() => {
    if (!enabled) return;
    const check = () => setSoundBlocked(!soundAllowed());
    const unlock = () => { void audioContext()?.resume().then(check); };
    check();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [enabled]);

  useEffect(() => {
    const onChange = () => setSoundOn(soundIsOn());
    window.addEventListener(SOUND_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => { window.removeEventListener(SOUND_EVENT, onChange); window.removeEventListener("storage", onChange); };
  }, []);

  // Opening Orders in any tab clears the count in every tab.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const open = new BroadcastChannel(CHANNEL);
    open.onmessage = () => setNewIds([]);
    channel.current = open;
    return () => { open.close(); channel.current = null; };
  }, []);
  useEffect(() => {
    viewing.current = viewingOrders;
    const clearIfSeen = () => { if (viewing.current && !document.hidden) { setNewIds([]); channel.current?.postMessage("seen"); } };
    clearIfSeen();
    document.addEventListener("visibilitychange", clearIfSeen);
    return () => document.removeEventListener("visibilitychange", clearIfSeen);
  }, [viewingOrders]);

  return { newCount: newIds.length, soundNeedsClick: enabled && soundOn && soundBlocked };
}

/** Settings card. The choice is saved per browser, so each device can have its own. */
export function OrderAlertsPanel() {
  const [soundOn, setSoundOn] = useState(soundIsOn);
  function change(next: boolean) {
    writeStorage(SOUND_KEY, next ? "on" : "off");
    setSoundOn(next);
    window.dispatchEvent(new Event(SOUND_EVENT));
  }
  async function test() {
    await audioContext()?.resume();
    playChime();
  }
  return <section className="panel settings-card" aria-labelledby="order-alerts-title">
    <div className="panel-head"><div><p className="overline">NEW ORDERS</p><h2 id="order-alerts-title">Order alerts</h2></div><StatusChip tone={soundOn ? "success" : "neutral"}>{soundOn ? "Sound on" : "Sound off"}</StatusChip></div>
    <p className="muted">While the dashboard is open, each new paid order plays a sound and adds to the count on the browser tab and the Orders menu. Opening Orders clears the count.</p>
    <label className="toggle-row"><input type="checkbox" checked={soundOn} onChange={event => change(event.target.checked)} /><span><b>Play a sound for new paid orders</b><small>Saved for this browser only. Keep the tab open and your device's sound on.</small></span></label>
    <div className="settings-actions"><button className="secondary" type="button" onClick={() => void test()}>Play test sound</button></div>
  </section>;
}
