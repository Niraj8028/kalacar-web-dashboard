import { useEffect, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { ImageField, TextField } from "./editor-fields";

type Seo = { title: string; description: string; favicon: string };
const DEFAULT: Seo = { title: "Kalacar — Small Devotional Murtis", description: "Shop small murtis for car dashboards, Devghars, and personal mandirs.", favicon: "" };
const same = (a: Seo, b: Seo) => a.title === b.title && a.description === b.description && a.favicon === b.favicon;

/** The name on the browser tab, the text Google shows under it, and the little tab icon. */
export function SeoPanel() {
  const [saved, setSaved] = useState<Seo | null>(null);
  const [draft, setDraft] = useState<Seo>(DEFAULT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    getJson<{ seo?: Partial<Seo> }>("/api/admin/settings", "Settings are unavailable right now.")
      .then(data => { if (active) { const seo = { ...DEFAULT, ...data.seo }; setSaved(seo); setDraft(seo); } })
      .catch(cause => { if (active) setError(errorText(cause, "Settings are unavailable right now.")); });
    return () => { active = false; };
  }, []);
  const change = (next: Partial<Seo>) => { setDraft(current => ({ ...current, ...next })); setError(""); setMessage(""); };
  const dirty = saved !== null && !same(draft, saved);
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await sendJson<{ seo: Seo }>("/api/admin/settings", "PATCH", { seo: { title: draft.title.trim(), description: draft.description.trim(), favicon: draft.favicon } });
      const seo = { ...DEFAULT, ...data.seo };
      setSaved(seo); setDraft(seo);
      setMessage("Saved. Reload the shop to see the new title and icon. Google updates its results on its next visit, which can take a few days.");
    } catch (cause) { setError(errorText(cause, "Could not save the website title.")); }
    finally { setBusy(false); }
  }
  const title = draft.title.trim() || DEFAULT.title;
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="seo-title">
    <div className="panel-head"><div><p className="overline">BROWSER TAB AND GOOGLE</p><h2 id="seo-title">Website title and icon</h2></div></div>
    {saved === null ? !error && <p className="muted">Loading…</p> : <div className="setting-stack">
      <TextField label="Website title" value={draft.title} max={120} onChange={value => change({ title: value })} hint={`Shown on the browser tab and as the blue heading in Google. Under 60 letters reads best (now ${title.length}).`} />
      <TextField label="Description" value={draft.description} rows={3} max={300} onChange={value => change({ description: value })} hint={`The grey text under the title in Google. About 150 letters reads best (now ${draft.description.trim().length}).`} />
      <ImageField label="Favicon (tab icon)" value={draft.favicon} onChange={favicon => change({ favicon })} />
      <p className="muted">{draft.favicon ? "Use a square PNG, at least 512 × 512, with a transparent background." : "Using the built-in Kalacar icon. Upload a square PNG, at least 512 × 512."}</p>
      <div className="seo-tab-preview" aria-label="Browser tab preview">{draft.favicon ? <img src={draft.favicon} alt="" /> : <i aria-hidden="true" />}<span>{title}</span><b aria-hidden="true">×</b></div>
      <div className="seo-google-preview" aria-label="Google result preview"><span>kalacar.in</span><b>{title}</b><p>{draft.description.trim() || DEFAULT.description}</p></div>
    </div>}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    {saved !== null && <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="text-button" type="button" disabled={!dirty || busy} onClick={() => setDraft(saved)}>Undo</button><button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button></div>}
  </section>;
}
