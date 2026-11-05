import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PackageIcon } from "./icons";

export type LabelTemplate = { deliverTo: string; from: string; details: string };
type Variable = { key: string; label: string };
export type LabelConfig = { template: LabelTemplate; defaults: LabelTemplate; variables: Variable[] };
export type LabelOrder = { id: string; date?: string; customer: string; phone?: string; address?: string; pincode?: string; item?: string; giftWrap?: boolean; trackingCourier?: string; trackingId?: string; items?: { name: string; variant?: string; quantity: number }[] };

export const COURIER_LABELS: Record<string, string> = { trackon: "Trackon", india_post: "India Post" };

async function loadConfig(): Promise<LabelConfig> {
  const response = await fetch("/api/admin/print-label", { cache: "no-store" });
  const data = await response.json().catch(() => ({})) as Partial<LabelConfig> & { error?: string };
  if (!response.ok || !data.template || !data.defaults || !data.variables) throw new Error(data.error || "The print label template is unavailable right now.");
  return data as LabelConfig;
}

export function useLabelConfig() {
  const [config, setConfig] = useState<LabelConfig | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadConfig().then(value => { if (active) setConfig(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "The print label template is unavailable right now."); });
    return () => { active = false; };
  }, []);
  return { config, error };
}

function labelValues(order: LabelOrder): Record<string, string> {
  const products = order.items?.length ? order.items.map(item => `${item.name}${item.variant && item.variant !== "Standard" ? ` (${item.variant})` : ""} x ${item.quantity}`).join(", ") : (order.item ?? "").replaceAll(" · ", " x ");
  const date = order.date ? new Date(order.date) : null;
  return { customer_name: order.customer.trim(), phone: order.phone?.trim() ?? "", address: order.address?.trim() ?? "", pincode: order.pincode?.trim() ?? "", order_id: order.id.slice(0, 8).toUpperCase(), order_date: date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date) : "", product_names: products, gift_line: order.giftWrap ? "Gift packaging" : "", courier: COURIER_LABELS[order.trackingCourier ?? ""] ?? "", tracking_id: order.trackingId ?? "", shop_name: "Kalacar" };
}

/** Fills one section. A line whose variables are all empty is dropped; one pass, so customer text can't act as a variable. */
function fillSection(template: string, values: Record<string, string>) {
  return template.split("\n").flatMap(line => {
    const keys = [...line.matchAll(/\{([a-z_]+)\}/g)].map(match => match[1]);
    if (keys.length && keys.every(key => !values[key])) return [];
    return [line.replace(/\{([a-z_]+)\}/g, (_match, key: string) => values[key] ?? "")];
  }).join("\n").trim();
}

function Label({ template, order }: { template: LabelTemplate; order: LabelOrder }) {
  const values = labelValues(order);
  const from = fillSection(template.from, values);
  const details = fillSection(template.details, values);
  return <article className="parcel-label">
    <section className="parcel-deliver"><span>DELIVER TO</span><p>{fillSection(template.deliverTo, values)}</p></section>
    {from && <section className="parcel-from"><span>FROM</span><p>{from}</p></section>}
    {details && <section className="parcel-details"><p>{details}</p></section>}
  </article>;
}

/** Opens the browser's print window with only this order's label on the page. */
export function PrintLabelButton({ order, config, configError }: { order: LabelOrder; config: LabelConfig | null; configError: string }) {
  const [printing, setPrinting] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!printing) return;
    const finish = () => setPrinting(false);
    window.addEventListener("afterprint", finish);
    const timer = window.setTimeout(() => window.print(), 50);
    return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", finish); };
  }, [printing]);
  function start() {
    if (!config) { setNotice(configError || "The print label template is still loading."); return; }
    setNotice(""); setPrinting(true);
  }
  return <>
    <button className="message-button" type="button" onClick={start}><PackageIcon size={15} />Print label</button>
    {notice && <small className="fulfillment-note" role="status">{notice}</small>}
    {printing && config && createPortal(<div className="print-sheet"><Label template={config.template} order={order} /><div className="print-cut-line" aria-hidden="true">Cut along this line</div></div>, document.body)}
  </>;
}

type Field = keyof LabelTemplate;
const FIELDS: { key: Field; label: string; rows: number; hint: string }[] = [
  { key: "deliverTo", label: "Deliver to", rows: 4, hint: "Printed largest, so the courier can read it easily." },
  { key: "from", label: "From (optional)", rows: 3, hint: "Add a return address or phone here, or leave it empty to hide this section." },
  { key: "details", label: "Order details (optional)", rows: 4, hint: "A line is left out when its details are empty, such as a tracking ID you don't have yet." },
];
const SAMPLE: LabelOrder = { id: "ab12cd34", date: "2026-11-05T05:15:00Z", customer: "Customer Name", phone: "98765 43210", address: "House and street\nArea, City, State", pincode: "411001", item: "Sample murti (Gold) · 1", giftWrap: true, trackingCourier: "trackon", trackingId: "TRACKING-ID" };

/** Settings panel: the label's wording, with a preview using sample details. */
export function PrintLabelPanel() {
  const { config, error: loadError } = useLabelConfig();
  const [saved, setSaved] = useState<LabelTemplate | null>(null);
  const [draft, setDraft] = useState<LabelTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const focused = useRef<HTMLTextAreaElement | null>(null);
  const focusedKey = useRef<Field>("deliverTo");
  const base = saved ?? config?.template ?? null;
  const current = draft ?? base;
  const changed = (key: Field) => Boolean(current && base && current[key] !== base[key]);
  const dirty = FIELDS.some(field => changed(field.key));
  function edit(key: Field, value: string) { if (current) setDraft({ ...current, [key]: value }); setError(""); setMessage(""); }
  function insert(variable: string) {
    if (!current) return;
    const key = focusedKey.current, element = focused.current, text = current[key];
    const start = element?.selectionStart ?? text.length, end = element?.selectionEnd ?? text.length, token = `{${variable}}`;
    edit(key, text.slice(0, start) + token + text.slice(end));
    window.requestAnimationFrame(() => { element?.focus(); element?.setSelectionRange(start + token.length, start + token.length); });
  }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/print-label", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: current }) });
      const data = await response.json().catch(() => ({})) as { template?: LabelTemplate; error?: string };
      if (!response.ok || !data.template) throw new Error(data.error || "Could not save the template.");
      setSaved(data.template); setDraft(data.template); setMessage("Label template saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the template."); }
    finally { setBusy(false); }
  }
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="label-title">
    <div className="panel-head"><div><p className="overline">ORDER UPDATES</p><h2 id="label-title">Print label</h2></div></div>
    <p className="muted">What prints when you click Print label on an order. It uses the top half of an A4 sheet, with a line to cut along.</p>
    {loadError && <p className="order-detail-error" role="alert">{loadError}</p>}
    {!config || !current ? !loadError && <p className="muted">Loading template…</p> : <>
      <div className="template-variables" role="group" aria-label="Insert a variable">{config.variables.map(variable => <button className="template-chip variable" type="button" key={variable.key} onMouseDown={event => event.preventDefault()} onClick={() => insert(variable.key)}>{variable.label}</button>)}</div>
      {FIELDS.map(field => <label className={`template-field${changed(field.key) ? " changed" : ""}`} key={field.key}>{field.label}<textarea rows={field.rows} maxLength={600} value={current[field.key]} onFocus={event => { focused.current = event.target; focusedKey.current = field.key; }} onChange={event => edit(field.key, event.target.value)} /><small className="field-hint">{field.hint}</small></label>)}
      <div className="settings-preview"><span className="overline">PREVIEW WITH SAMPLE DETAILS</span><div className="label-preview"><Label template={current} order={SAMPLE} /></div></div>
      {error && <p className="order-detail-error" role="alert">{error}</p>}
      {message && <p className="order-saved" role="status">{message}</p>}
      <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="text-button" type="button" disabled={busy} onClick={() => { setDraft(config.defaults); setError(""); setMessage("Default text restored. Press Save to keep it."); }}>Reset to default</button><button className="text-button" type="button" disabled={!dirty || busy} onClick={() => { setDraft(base); setError(""); setMessage(""); }}>Undo</button><button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save template"}</button></div>
    </>}
  </section>;
}
