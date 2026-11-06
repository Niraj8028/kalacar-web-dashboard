import { useEffect, useState } from "react";
import { SettingSwitch } from "./setting-switch";

type Festive = { diwali: boolean };

/** Turns the Diwali decoration on the shop on or off. */
export function FestivePanel() {
  const [saved, setSaved] = useState<Festive | null>(null);
  const [draft, setDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as { festive?: Festive; error?: string };
        if (!response.ok || !data.festive) throw new Error(data.error || "Settings are unavailable right now.");
        if (active) { setSaved(data.festive); setDraft(data.festive.diwali); }
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Settings are unavailable right now."); });
    return () => { active = false; };
  }, []);
  const dirty = saved !== null && draft !== saved.diwali;
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ festive: { diwali: draft } }) });
      const data = await response.json().catch(() => ({})) as { festive?: Festive; error?: string };
      if (!response.ok || !data.festive) throw new Error(data.error || "Could not save the decoration.");
      setSaved(data.festive); setDraft(data.festive.diwali);
      setMessage(data.festive.diwali ? "Saved. The decoration is on." : "Saved. The decoration is off.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the decoration."); }
    finally { setBusy(false); }
  }
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="festive-title">
    <div className="panel-head"><div><p className="overline">FESTIVAL</p><h2 id="festive-title">Diwali decoration</h2></div></div>
    <p className="muted">Hangs a flower garland and lights across the top of the shop, with diyas on the home page. Customers can still click everything under it. It stays off the cart and account pages.</p>
    {saved !== null && <div className="setting-stack"><SettingSwitch label="Show Diwali decoration" hint="Customers see it as soon as you save." checked={draft} onChange={value => { setDraft(value); setError(""); setMessage(""); }} /></div>}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    {saved !== null && <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button></div>}
  </section>;
}
