import { useEffect, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { Check, ImageField } from "./editor-fields";

type Brand = { logo: string; width: number; white: boolean };
const BUILT_IN = "/images/kalakar-logo.png";
const EMPTY: Brand = { logo: "", width: 0, white: false };
const DEFAULT_WIDTH = 150;
const same = (a: Brand, b: Brand) => a.logo === b.logo && a.width === b.width && a.white === b.white;

/** The shop logo in the header and footer of every page, with its size and colour. */
export function LogoPanel() {
  const [saved, setSaved] = useState<Brand | null>(null);
  const [draft, setDraft] = useState<Brand>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    getJson<{ brand?: Partial<Brand> }>("/api/admin/settings", "Settings are unavailable right now.")
      .then(data => { if (active) { const brand = { ...EMPTY, ...data.brand }; setSaved(brand); setDraft(brand); } })
      .catch(cause => { if (active) setError(errorText(cause, "Settings are unavailable right now.")); });
    return () => { active = false; };
  }, []);
  const change = (next: Partial<Brand>) => { setDraft(current => ({ ...current, ...next })); setError(""); setMessage(""); };
  const dirty = saved !== null && !same(draft, saved);
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await sendJson<{ brand: Brand }>("/api/admin/settings", "PATCH", { brand: draft });
      const brand = { ...EMPTY, ...data.brand };
      setSaved(brand); setDraft(brand);
      setMessage("Saved. The shop shows the new logo now.");
    } catch (cause) { setError(errorText(cause, "Could not save the logo.")); }
    finally { setBusy(false); }
  }
  const width = draft.width || DEFAULT_WIDTH;
  const white = !draft.logo || draft.white;
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="logo-title">
    <div className="panel-head"><div><p className="overline">BRAND</p><h2 id="logo-title">Logo</h2></div></div>
    <p className="muted">Shown in the header and footer of every page. Use a PNG with a transparent background.</p>
    {saved === null ? !error && <p className="muted">Loading logo…</p> : <div className="setting-stack">
      <ImageField label="Shop logo" value={draft.logo} onChange={logo => change({ logo })} />
      {!draft.logo && <p className="muted">Using the built-in Kalacar logo.</p>}
      {draft.logo && <Check label="Show the logo in white" hint="Off keeps your logo's own colours. Turn on only if it's hard to see on the dark header." checked={draft.white} onChange={next => change({ white: next })} />}
      <label className="setting-field">Logo width on computers: {width}px{!draft.width && " (default)"}
        <input type="range" min={60} max={320} step={2} value={width} onChange={event => change({ width: Number(event.target.value) })} />
      </label>
      <p className="muted">Phones show it at 70% of this width ({Math.round(width * 0.7)}px).{draft.width ? <> <button className="text-button" type="button" onClick={() => change({ width: 0 })}>Use the default size</button></> : null}</p>
      <div className="logo-preview" aria-label="Preview on the dark header">
        <img src={draft.logo || BUILT_IN} alt="Logo preview" style={{ width, filter: white ? "brightness(0) invert(1)" : "none" }} />
      </div>
    </div>}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    {saved !== null && <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button></div>}
  </section>;
}
