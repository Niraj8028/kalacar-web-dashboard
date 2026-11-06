import { useState } from "react";
import type { ReactNode } from "react";
import { errorText, uploadImage } from "./admin-api";

export function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (value: boolean) => void; hint?: string }) {
  return <label className="editor-check"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}{hint && <small>{hint}</small>}</span></label>;
}

/** A text box with its own "show this" checkbox, as requested for every inner field. */
export function ToggleText({ label, show, onShow, value, onChange, max, rows = 0, placeholder }: { label: string; show: boolean; onShow: (value: boolean) => void; value: string; onChange: (value: string) => void; max: number; rows?: number; placeholder?: string }) {
  return <div className={show ? "toggle-field" : "toggle-field off"}>
    <Check label={`Show ${label.toLowerCase()}`} checked={show} onChange={onShow} />
    <label>{label}{rows ? <textarea rows={rows} maxLength={max} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /> : <input maxLength={max} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />}</label>
  </div>;
}

export function TextField({ label, value, onChange, max, rows = 0, placeholder, hint }: { label: string; value: string; onChange: (value: string) => void; max: number; rows?: number; placeholder?: string; hint?: string }) {
  return <label className="editor-field">{label}{rows ? <textarea rows={rows} maxLength={max} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /> : <input maxLength={max} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />}{hint && <small className="field-hint">{hint}</small>}</label>;
}

export function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function choose(file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    try { onChange(await uploadImage(file)); }
    catch (cause) { setError(errorText(cause, "Could not save the photo.")); }
    finally { setBusy(false); }
  }
  return <div className="image-field">
    <span>{label}</span>
    <div>
      {value ? <img src={value} alt="" /> : <span className="image-field-empty" aria-hidden="true" />}
      <label className="secondary image-field-button">{busy ? "Uploading…" : value ? "Change photo" : "Upload photo"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-label={label} disabled={busy} onChange={event => { void choose(event.target.files?.[0]); event.target.value = ""; }} /></label>
      {value && <button className="text-button" type="button" onClick={() => onChange("")}>Remove</button>}
    </div>
    {error && <small className="fulfillment-error" role="alert">{error}</small>}
  </div>;
}

export function SectionCard({ title, overline, show, onShow, children }: { title: string; overline: string; show: boolean; onShow: (value: boolean) => void; children: ReactNode }) {
  return <section className={show ? "panel settings-card editor-section" : "panel settings-card editor-section off"}>
    <div className="panel-head"><div><p className="overline">{overline}</p><h2>{title}</h2></div><Check label="Show on site" checked={show} onChange={onShow} /></div>
    {show ? children : <p className="muted">Hidden on the site. Tick the box to edit and show it.</p>}
  </section>;
}

export function SaveBar({ dirty, busy, message, error, onUndo, onSave, label = "Save" }: { dirty: boolean; busy: boolean; message: string; error: string; onUndo: () => void; onSave: () => void; label?: string }) {
  return <div className="editor-savebar">
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && !dirty && <p className="order-saved" role="status">{message}</p>}
    <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="text-button" type="button" disabled={!dirty || busy} onClick={onUndo}>Undo</button><button className="primary" type="button" disabled={!dirty || busy} onClick={onSave}>{busy ? "Saving…" : label}</button></div>
  </div>;
}
