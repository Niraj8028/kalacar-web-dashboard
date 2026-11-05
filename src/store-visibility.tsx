import { useEffect, useState } from "react";

export type StoreSettings = { mode: "live" | "coming_soon"; comingSoonMessage: string; announcementEnabled: boolean; announcementText: string };

export async function loadStoreSettings(): Promise<StoreSettings> {
  const response = await fetch("/api/admin/settings", { cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { store?: StoreSettings; error?: string };
  if (!response.ok || !data.store) throw new Error(data.error || "Settings are unavailable right now.");
  return data.store;
}

/** Settings panel: open or close the shop, and the banner shown across its pages. Nothing changes until Save. */
export function StoreVisibilityPanel({ onSaved }: { onSaved: (store: StoreSettings) => void }) {
  const [saved, setSaved] = useState<StoreSettings | null>(null);
  const [draft, setDraft] = useState<StoreSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    loadStoreSettings().then(store => { if (active) { setSaved(store); setDraft(store); } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Settings are unavailable right now."); });
    return () => { active = false; };
  }, []);
  const dirty = Boolean(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));
  function edit(change: Partial<StoreSettings>) { setDraft(current => current && { ...current, ...change }); setError(""); setMessage(""); }
  async function save() {
    if (!draft) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ store: draft }) });
      const data = await response.json().catch(() => ({})) as { store?: StoreSettings; error?: string };
      if (!response.ok || !data.store) throw new Error(data.error || "Could not save settings.");
      setSaved(data.store); setDraft(data.store); onSaved(data.store);
      setMessage(data.store.mode === "live" ? "Saved. The shop is live for customers." : "Saved. Customers now see the coming soon page.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save settings."); }
    finally { setBusy(false); }
  }
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="visibility-title">
    <div className="panel-head"><div><p className="overline">SHOP</p><h2 id="visibility-title">Visibility and banner</h2></div></div>
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {!draft ? !error && <p className="muted">Loading settings…</p> : <>
      <div className="visibility-options" role="radiogroup" aria-label="Shop visibility">
        <label className="toggle-row"><input type="radio" name="store-mode" checked={draft.mode === "live"} onChange={() => edit({ mode: "live" })} /><span><b>Live</b><small>Customers can browse and place orders.</small></span></label>
        <label className="toggle-row"><input type="radio" name="store-mode" checked={draft.mode === "coming_soon"} onChange={() => edit({ mode: "coming_soon" })} /><span><b>Coming soon</b><small>Customers see a simple page and can't place new orders. Sign in on the shop with an owner account to preview it.</small></span></label>
      </div>
      <label className="template-field">Coming soon message<input maxLength={200} value={draft.comingSoonMessage} onChange={event => edit({ comingSoonMessage: event.target.value })} /></label>
      <label className="toggle-row"><input type="checkbox" checked={draft.announcementEnabled} onChange={event => edit({ announcementEnabled: event.target.checked })} /><span><b>Show a banner on the shop</b><small>Shown at the top of shop pages. While the shop is Coming soon, it shows only on Account and policy pages.</small></span></label>
      <label className="template-field">Banner message<input maxLength={160} placeholder="e.g. Orders placed this week ship after 15 November" value={draft.announcementText} onChange={event => edit({ announcementText: event.target.value })} /></label>
      {draft.announcementEnabled && draft.announcementText.trim() && <div className="settings-preview"><span className="overline">PREVIEW</span><p className="visibility-banner-preview">{draft.announcementText}</p></div>}
      {message && <p className="order-saved" role="status">{message}</p>}
      <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="text-button" type="button" disabled={!dirty || busy} onClick={() => { setDraft(saved); setError(""); setMessage(""); }}>Undo</button><button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button></div>
    </>}
  </section>;
}
