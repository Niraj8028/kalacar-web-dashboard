import { useEffect, useState } from "react";

type Overlay = "off" | "diwali" | "ganpati" | "janmashtami";
const OPTIONS: { value: Overlay; label: string; hint: string; colours: string[] }[] = [
  { value: "off", label: "None", hint: "No decoration", colours: ["#c9c7bf"] },
  { value: "diwali", label: "Diwali", hint: "Marigolds, lights, diyas and sky lanterns", colours: ["#f59f0b", "#e8590c", "#ffd43b"] },
  { value: "ganpati", label: "Ganpati Utsav", hint: "Hibiscus, bells and modak plates", colours: ["#e03131", "#f59f0b", "#2f7d32"] },
  { value: "janmashtami", label: "Janmashtami and Dahi Handi", hint: "Peacock feathers, butter pots and flute", colours: ["#12a0a8", "#2f9e44", "#ffc53d"] },
];

/** Chooses the festival decoration on the shop, or none. */
export function FestivePanel() {
  const [saved, setSaved] = useState<Overlay | null>(null);
  const [draft, setDraft] = useState<Overlay>("off");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as { festive?: { overlay: Overlay }; error?: string };
        if (!response.ok || !data.festive) throw new Error(data.error || "Settings are unavailable right now.");
        if (active) { setSaved(data.festive.overlay); setDraft(data.festive.overlay); }
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Settings are unavailable right now."); });
    return () => { active = false; };
  }, []);
  const dirty = saved !== null && draft !== saved;
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ festive: { overlay: draft } }) });
      const data = await response.json().catch(() => ({})) as { festive?: { overlay: Overlay }; error?: string };
      if (!response.ok || !data.festive) throw new Error(data.error || "Could not save the decoration.");
      setSaved(data.festive.overlay); setDraft(data.festive.overlay);
      setMessage(data.festive.overlay === "off" ? "Saved. The decoration is off." : "Saved. The decoration is on.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the decoration."); }
    finally { setBusy(false); }
  }
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="festive-title">
    <div className="panel-head"><div><p className="overline">FESTIVAL</p><h2 id="festive-title">Festival decoration</h2></div></div>
    <p className="muted">Hangs a garland across the top of the shop, with decorations in the corners of the home page. Customers can still click everything under it. It stays off the cart and account pages.</p>
    {saved !== null && <div className="festive-options" role="radiogroup" aria-labelledby="festive-title">{OPTIONS.map(option => <button type="button" key={option.value} role="radio" aria-checked={draft === option.value} className={`festive-option${draft === option.value ? " selected" : ""}`} onClick={() => { setDraft(option.value); setError(""); setMessage(""); }}>
      <span className="festive-option-colours" aria-hidden="true">{option.colours.map(colour => <i key={colour} style={{ background: colour }} />)}</span>
      <b>{option.label}</b>
      <small>{option.hint}</small>
    </button>)}</div>}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    {saved !== null && <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button></div>}
  </section>;
}
