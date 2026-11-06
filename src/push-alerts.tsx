import { useEffect, useState } from "react";
import { StatusChip } from "./dashboard-ui";

// Pop-up alerts that arrive with the dashboard closed. Each device turns them on for itself.
type PushState = "checking" | "unsupported" | "needsHomeScreen" | "notSetUp" | "blocked" | "off" | "on";

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIphone = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const installed = () => window.matchMedia("(display-mode: standalone)").matches;

function toKey(text: string) {
  const padded = `${text}${"=".repeat((4 - text.length % 4) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), letter => letter.charCodeAt(0));
}

async function currentDevice() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function send(method: "POST" | "DELETE", path: string, body: unknown) {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (response.ok) return;
  const data = await response.json().catch(() => ({})) as { error?: string };
  throw new Error(data.error || "That didn't work. Try again.");
}

/** Used on sign-out, so a shared computer stops getting alerts. Must run before the session ends. */
export async function removeThisDeviceFromAlerts() {
  try {
    if (!supported()) return;
    const device = await currentDevice();
    if (!device) return;
    await send("DELETE", "/api/admin/push", { endpoint: device.endpoint });
    await device.unsubscribe();
  } catch { /* Sign-out carries on; the server drops devices that stop working. */ }
}

export function PushAlertsSection() {
  const [state, setState] = useState<PushState>("checking");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supported()) return isIphone() && !installed() ? "needsHomeScreen" : "unsupported";
      const response = await fetch("/api/admin/push", { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as { publicKey?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Browser alerts are unavailable right now.");
      if (!data.publicKey) return "notSetUp";
      if (active) setPublicKey(data.publicKey);
      if (Notification.permission === "denied") return "blocked";
      return (await currentDevice()) && Notification.permission === "granted" ? "on" : "off";
    })().then(next => { if (active) setState(next as PushState); }).catch(cause => { if (active) { setState("off"); setError(cause instanceof Error ? cause.message : "Browser alerts are unavailable right now."); } });
    return () => { active = false; };
  }, []);

  async function run(action: () => Promise<PushState | void>) {
    setBusy(true); setError(""); setMessage("");
    try { const next = await action(); if (next) setState(next); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn't work. Try again."); }
    finally { setBusy(false); }
  }
  const turnOn = () => run(async () => {
    const permission = await Notification.requestPermission();
    if (permission === "denied") return "blocked";
    if (permission !== "granted") return "off";
    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;
    let device;
    // Brave blocks this unless its Google push setting is on, and the browser's own error doesn't say so.
    try { device = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }); }
    catch { throw new Error("This browser refused alerts. In Brave, turn on \"Use Google services for push messaging\" in Settings > Privacy and security, then try again."); }
    await send("POST", "/api/admin/push", device.toJSON());
    setMessage("Alerts are on for this device.");
    return "on";
  });
  const turnOff = () => run(async () => {
    const device = await currentDevice();
    if (device) { await send("DELETE", "/api/admin/push", { endpoint: device.endpoint }); await device.unsubscribe(); }
    setMessage("Alerts are off for this device.");
    return "off";
  });
  const test = () => run(async () => {
    const device = await currentDevice();
    if (!device) return "off";
    await send("POST", "/api/admin/push/test", { endpoint: device.endpoint });
    setMessage("Test alert sent. It should pop up in a few seconds.");
  });

  const notes: Partial<Record<PushState, string>> = {
    unsupported: "This browser doesn't support pop-up alerts.",
    needsHomeScreen: "On iPhone, first add this dashboard to your Home Screen: tap Share, then Add to Home Screen. Open it from there and turn alerts on.",
    notSetUp: "Pop-up alerts aren't set up on the server yet, so they can't be turned on.",
    blocked: "Notifications are blocked for this site. Allow them in your browser's site settings, then reload this page.",
  };
  return <div className="push-alerts">
    <div className="push-alerts-head"><div><b>Pop-up alerts on this device</b><small>Show a pop-up for each new paid order, even with the dashboard closed. Clicking it opens the order. Your browser needs to be running.</small></div><StatusChip tone={state === "on" ? "success" : state === "blocked" ? "danger" : "neutral"}>{state === "checking" ? "Checking" : state === "on" ? "On" : "Off"}</StatusChip></div>
    {notes[state] && <p className="muted">{notes[state]}</p>}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    {(state === "off" || state === "on") && <div className="settings-actions">
      {state === "on" && <button className="secondary" type="button" disabled={busy} onClick={() => void test()}>Send test alert</button>}
      {state === "on" ? <button className="secondary" type="button" disabled={busy} onClick={() => void turnOff()}>Turn off</button> : <button className="primary" type="button" disabled={busy || !publicKey} onClick={() => void turnOn()}>{busy ? "Turning on…" : "Turn on"}</button>}
    </div>}
  </div>;
}
