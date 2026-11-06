import { useEffect, useState } from "react";
import { ExternalLinkIcon } from "./icons";

export async function loadShopLink() {
  const response = await fetch("/api/admin/settings", { cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { shopLink?: string; error?: string };
  if (!response.ok || typeof data.shopLink !== "string") throw new Error(data.error || "Settings are unavailable right now.");
  return data.shopLink;
}

/** Opens the customer website in a new tab, which the browser brings to the front. */
export function VisitWebsiteLink({ link, onSetUp }: { link: string; onSetUp: () => void }) {
  if (!link) return <button className="visit-website" type="button" onClick={onSetUp}>Set website link</button>;
  return <a className="visit-website" href={link} target="_blank" rel="noopener noreferrer">Visit website <ExternalLinkIcon size={13} /></a>;
}

export function ShopLinkPanel({ onSaved }: { onSaved: (link: string) => void }) {
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    loadShopLink().then(link => { if (active) { setSaved(link); setDraft(link); } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Settings are unavailable right now."); });
    return () => { active = false; };
  }, []);
  const dirty = saved !== null && draft.trim() !== saved;
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopLink: draft }) });
      const data = await response.json().catch(() => ({})) as { shopLink?: string; error?: string };
      if (!response.ok || typeof data.shopLink !== "string") throw new Error(data.error || "Could not save the website link.");
      setSaved(data.shopLink); setDraft(data.shopLink); onSaved(data.shopLink);
      setMessage("Saved. Visit website now opens this address.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the website link."); }
    finally { setBusy(false); }
  }
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="shop-link-title">
    <div className="panel-head"><div><p className="overline">WEBSITE</p><h2 id="shop-link-title">Website link</h2></div></div>
    <p className="muted">The Visit website link at the top of the menu opens this address in a new tab.</p>
    {saved === null ? !error && <p className="muted">Loading website link…</p> : <div className="settings-grid">
      <label>Customer website address<input type="url" inputMode="url" maxLength={200} value={draft} placeholder="https://kalacar.in" onChange={event => { setDraft(event.target.value); setError(""); setMessage(""); }} /><small className="field-hint">Leave it empty to use the shop's default address.</small></label>
    </div>}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    {saved !== null && <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="text-button" type="button" disabled={!dirty || busy} onClick={() => { setDraft(saved); setError(""); setMessage(""); }}>Undo</button><button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save link"}</button></div>}
  </section>;
}
