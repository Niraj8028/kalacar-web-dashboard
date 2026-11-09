import { useEffect, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { ImageField } from "./editor-fields";

type Brand = { logo: string };
const BUILT_IN = "/images/kalakar-logo.png";

/** The shop logo in the header and footer of every page. Empty uses the built-in Kalacar logo. */
export function LogoPanel() {
  const [saved, setSaved] = useState<Brand | null>(null);
  const [draft, setDraft] = useState<Brand>({ logo: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    getJson<{ brand?: Brand }>("/api/admin/settings", "Settings are unavailable right now.")
      .then(data => { if (active) { const brand = data.brand ?? { logo: "" }; setSaved(brand); setDraft(brand); } })
      .catch(cause => { if (active) setError(errorText(cause, "Settings are unavailable right now.")); });
    return () => { active = false; };
  }, []);
  const dirty = saved !== null && draft.logo !== saved.logo;
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await sendJson<{ brand: Brand }>("/api/admin/settings", "PATCH", { brand: draft });
      setSaved(data.brand); setDraft(data.brand);
      setMessage("Saved. The shop shows the new logo now.");
    } catch (cause) { setError(errorText(cause, "Could not save the logo.")); }
    finally { setBusy(false); }
  }
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="logo-title">
    <div className="panel-head"><div><p className="overline">BRAND</p><h2 id="logo-title">Logo</h2></div></div>
    <p className="muted">Shown in the header and footer of every page. Use a PNG with a transparent background. On the black header and footer it's shown in white.</p>
    {saved === null ? !error && <p className="muted">Loading logo…</p> : <div className="setting-stack">
      <ImageField label="Shop logo" value={draft.logo} onChange={logo => { setDraft({ logo }); setError(""); setMessage(""); }} />
      {!draft.logo && <p className="muted">Using the built-in Kalacar logo. <img src={BUILT_IN} alt="Built-in Kalacar logo" style={{ height: 32, verticalAlign: "middle", marginLeft: 6 }} /></p>}
    </div>}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    {saved !== null && <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button></div>}
  </section>;
}
