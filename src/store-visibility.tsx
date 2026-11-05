import { useEffect, useState } from "react";

export type StoreSettings = { mode: "live" | "coming_soon"; comingSoonMessage: string; announcementEnabled: boolean; announcementText: string };
type VisibilityFields = Pick<StoreSettings, "mode" | "comingSoonMessage">;
type BannerFields = Pick<StoreSettings, "announcementEnabled" | "announcementText">;

export async function loadStoreSettings(): Promise<StoreSettings> {
  const response = await fetch("/api/admin/settings", { cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { store?: StoreSettings; error?: string };
  if (!response.ok || !data.store) throw new Error(data.error || "Settings are unavailable right now.");
  return data.store;
}

async function saveStore(store: StoreSettings) {
  const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ store }) });
  const data = await response.json().catch(() => ({})) as { store?: StoreSettings; error?: string };
  if (!response.ok || !data.store) throw new Error(data.error || "Could not save settings.");
  return data.store;
}

function CardActions({ dirty, busy, onUndo, onSave }: { dirty: boolean; busy: boolean; onUndo: () => void; onSave: () => void }) {
  return <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="text-button" type="button" disabled={!dirty || busy} onClick={onUndo}>Undo</button><button className="primary" type="button" disabled={!dirty || busy} onClick={onSave}>{busy ? "Saving…" : "Save"}</button></div>;
}

function VisibilityCard({ initial, latest, onSaved }: { initial: VisibilityFields; latest: () => StoreSettings; onSaved: (store: StoreSettings) => void }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = draft.mode !== saved.mode || draft.comingSoonMessage !== saved.comingSoonMessage;
  function edit(change: Partial<VisibilityFields>) { setDraft(current => ({ ...current, ...change })); setError(""); setMessage(""); }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const store = await saveStore({ ...latest(), ...draft });
      setSaved({ mode: store.mode, comingSoonMessage: store.comingSoonMessage }); setDraft({ mode: store.mode, comingSoonMessage: store.comingSoonMessage }); onSaved(store);
      setMessage(store.mode === "live" ? "Saved. Your shop is open to customers." : "Saved. Customers now see the Coming soon page.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save settings."); }
    finally { setBusy(false); }
  }
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="visibility-title">
    <div className="panel-head"><div><p className="overline">CUSTOMER SHOP</p><h2 id="visibility-title">Shop status</h2></div></div>
    <p className="muted">Choose whether customers can use your shop. Your products and orders stay safe either way, and this dashboard stays open.</p>
    <div className="visibility-options" role="radiogroup" aria-label="Shop status">
      <label className="toggle-row"><input type="radio" name="store-mode" checked={draft.mode === "live"} onChange={() => edit({ mode: "live" })} /><span><b>Live</b><small>Your shop is open. Customers can browse and place orders.</small></span></label>
      <label className="toggle-row"><input type="radio" name="store-mode" checked={draft.mode === "coming_soon"} onChange={() => edit({ mode: "coming_soon" })} /><span><b>Coming soon</b><small>Your shop is closed. Customers see a Coming soon page and can&apos;t place new orders. To check the shop yourself, sign in on it with your owner Google account.</small></span></label>
    </div>
    <label className="template-field">Message on the Coming soon page<input maxLength={200} value={draft.comingSoonMessage} onChange={event => edit({ comingSoonMessage: event.target.value })} /></label>
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    <CardActions dirty={dirty} busy={busy} onUndo={() => { setDraft(saved); setError(""); setMessage(""); }} onSave={() => void save()} />
  </section>;
}

function BannerCard({ initial, latest, onSaved }: { initial: BannerFields; latest: () => StoreSettings; onSaved: (store: StoreSettings) => void }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = draft.announcementEnabled !== saved.announcementEnabled || draft.announcementText !== saved.announcementText;
  function edit(change: Partial<BannerFields>) { setDraft(current => ({ ...current, ...change })); setError(""); setMessage(""); }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const store = await saveStore({ ...latest(), ...draft });
      const next = { announcementEnabled: store.announcementEnabled, announcementText: store.announcementText };
      setSaved(next); setDraft(next); onSaved(store);
      setMessage(store.announcementEnabled ? "Saved. Customers can see this banner." : "Saved. The banner is off.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save settings."); }
    finally { setBusy(false); }
  }
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="banner-title">
    <div className="panel-head"><div><p className="overline">CUSTOMER SHOP</p><h2 id="banner-title">Shop banner</h2></div></div>
    <p className="muted">A short message across the top of your shop, for offers or delivery notices. While the shop is Coming soon, only Account and policy pages show it.</p>
    <label className="toggle-row"><input type="checkbox" checked={draft.announcementEnabled} onChange={event => edit({ announcementEnabled: event.target.checked })} /><span><b>Show a banner on the shop</b><small>Turn this off to hide the banner without losing your message.</small></span></label>
    <label className="template-field">Banner message<input maxLength={160} placeholder="e.g. Orders placed this week ship after 15 November" value={draft.announcementText} onChange={event => edit({ announcementText: event.target.value })} /></label>
    {draft.announcementEnabled && draft.announcementText.trim() && <div className="settings-preview"><span className="overline">PREVIEW</span><p className="visibility-banner-preview">{draft.announcementText}</p></div>}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    <CardActions dirty={dirty} busy={busy} onUndo={() => { setDraft(saved); setError(""); setMessage(""); }} onSave={() => void save()} />
  </section>;
}

/** Two separate cards. Each saves only its own fields, keeping the other card's saved values. */
export function StoreVisibilityPanel({ onSaved }: { onSaved: (store: StoreSettings) => void }) {
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadStoreSettings().then(value => { if (active) setStore(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Settings are unavailable right now."); });
    return () => { active = false; };
  }, []);
  if (!store) return <section className="panel settings-card" aria-label="Shop status">{error ? <p className="order-detail-error" role="alert">{error}</p> : <p className="muted">Loading settings…</p>}</section>;
  const updated = (value: StoreSettings) => { setStore(value); onSaved(value); };
  return <>
    <VisibilityCard initial={{ mode: store.mode, comingSoonMessage: store.comingSoonMessage }} latest={() => store} onSaved={updated} />
    <BannerCard initial={{ announcementEnabled: store.announcementEnabled, announcementText: store.announcementText }} latest={() => store} onSaved={updated} />
  </>;
}
