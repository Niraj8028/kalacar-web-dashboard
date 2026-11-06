import { useEffect, useState } from "react";
import { ExternalLinkIcon } from "./icons";
import { SettingSwitch } from "./setting-switch";

type Instagram = { show: boolean; username: string };

/** The shop's Instagram account. The home page band and the follow button below the videos open it. */
export function InstagramPanel() {
  const [saved, setSaved] = useState<Instagram | null>(null);
  const [draft, setDraft] = useState<Instagram>({ show: false, username: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as { instagram?: Instagram; error?: string };
        if (!response.ok || !data.instagram) throw new Error(data.error || "Settings are unavailable right now.");
        if (active) { setSaved(data.instagram); setDraft(data.instagram); }
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Settings are unavailable right now."); });
    return () => { active = false; };
  }, []);
  const dirty = saved !== null && (draft.show !== saved.show || draft.username.trim() !== saved.username);
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instagram: draft }) });
      const data = await response.json().catch(() => ({})) as { instagram?: Instagram; error?: string };
      if (!response.ok || !data.instagram) throw new Error(data.error || "Could not save the Instagram account.");
      setSaved(data.instagram); setDraft(data.instagram);
      setMessage("Saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the Instagram account."); }
    finally { setBusy(false); }
  }
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="instagram-title">
    <div className="panel-head"><div><p className="overline">SOCIAL</p><h2 id="instagram-title">Instagram</h2></div></div>
    <p className="muted">Shows a follow band above the footer and a follow button below the videos on the home page. Both open this account.</p>
    {saved === null ? !error && <p className="muted">Loading Instagram account…</p> : <div className="setting-stack">
      <label className="setting-field">Instagram username<input maxLength={120} value={draft.username} placeholder="yourpage" autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={event => { setDraft(current => ({ ...current, username: event.target.value })); setError(""); setMessage(""); }} /></label>
      <SettingSwitch label="Show on the home page" hint="Turn off to hide the band and the follow button." checked={draft.show} onChange={show => { setDraft(current => ({ ...current, show })); setError(""); setMessage(""); }} />
    </div>}
    {saved?.username && <p className="setting-link"><a href={`https://www.instagram.com/${saved.username}/`} target="_blank" rel="noopener noreferrer">Open @{saved.username} <ExternalLinkIcon size={13} /></a></p>}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    {saved !== null && <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button></div>}
  </section>;
}
