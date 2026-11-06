import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ChatIcon, MailIcon, PhoneIcon, SmsIcon } from "./icons";

export type MessageTemplate = { whatsapp: string; sms: string; emailSubject: string; emailBody: string };
type Templates = Record<string, MessageTemplate>;
type Variable = { key: string; label: string };
export type MessageConfig = { templates: Templates; defaults: Templates; variables: Variable[] };
export type MessageOrder = { id: string; customer: string; email?: string; phone?: string; item?: string; total: number; trackingNote?: string; trackingCourier?: string; trackingId?: string; items?: { name: string; variant?: string; quantity: number }[] };

const STATUSES = [["unfulfilled", "Not started"], ["processing", "Preparing"], ["dispatched", "Dispatched"], ["completed", "Completed"]] as const;
const statusLabel = (status: string) => STATUSES.find(item => item[0] === status)?.[1] ?? status;
const MAX_EMAIL_LINK = 2000;
const COURIERS: Record<string, { label: string; url: string }> = { trackon: { label: "Trackon", url: "https://www.trackon.in/courier-tracking" }, india_post: { label: "India Post", url: "https://www.indiapost.gov.in/" } };

async function loadConfig(): Promise<MessageConfig> {
  const response = await fetch("/api/admin/order-messages", { cache: "no-store" });
  const data = await response.json().catch(() => ({})) as Partial<MessageConfig> & { error?: string };
  if (!response.ok || !data.templates || !data.defaults || !data.variables) throw new Error(data.error || "Message templates are unavailable right now.");
  return data as MessageConfig;
}

export function useMessageConfig() {
  const [config, setConfig] = useState<MessageConfig | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadConfig().then(value => { if (active) setConfig(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Message templates are unavailable right now."); });
    return () => { active = false; };
  }, []);
  return { config, error };
}

const productNames = (order: MessageOrder) => order.items?.length
  ? order.items.map(item => `${item.name}${item.variant && item.variant !== "Standard" ? ` (${item.variant})` : ""} x ${item.quantity}`).join(", ")
  : (order.item ?? "").replaceAll(" · ", " x ");

export function orderValues(order: MessageOrder, status: string): Record<string, string> {
  const name = order.customer.trim();
  return { customer_name: name, first_name: name.split(/\s+/)[0] ?? "", product_names: productNames(order), order_id: order.id.slice(0, 8).toUpperCase(), order_total: `₹${order.total.toLocaleString("en-IN")}`, status: statusLabel(status), courier: COURIERS[order.trackingCourier ?? ""]?.label ?? "", tracking_id: order.trackingId ?? "", tracking_link: COURIERS[order.trackingCourier ?? ""]?.url ?? "", tracking_note: order.trackingNote?.trim() ?? "", shop_name: "Kalacar" };
}

/** Fills a template in one pass, so a customer's own text can't be read as a variable. */
export function fill(template: string, values: Record<string, string>, labels: Variable[]) {
  const missing = new Set<string>();
  const text = template.replace(/\{([a-z_]+)\}/g, (_match, key: string) => {
    if (!values[key]) missing.add(labels.find(item => item.key === key)?.label.toLowerCase() ?? key);
    return values[key] ?? "";
  });
  return { text, missing: [...missing] };
}

/** Indian 10-digit numbers get 91; other numbers must already include a country code. */
export function whatsappNumber(phone = "") {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : "";
}

export function mailLink(email: string, subject: string, body: string) {
  const [local, domain] = email.split("@");
  const encode = (text: string) => encodeURIComponent(text.replace(/\r?\n/g, "\r\n"));
  return `mailto:${encodeURIComponent(local)}@${encodeURIComponent(domain)}?subject=${encode(subject)}&body=${encode(body)}`;
}

const missingNote = (missing: string[]) => `Add the ${missing.join(" and ")} first, or remove ${missing.length > 1 ? "them" : "it"} from this template in Settings.`;

/** Opens WhatsApp, the SMS app or the mail app with the message filled in, or starts a call; the owner presses Send or Call there. Never changes the order. */
export function MessageButtons({ order, status, unsaved, config, configError, showCopy = false }: { order: MessageOrder; status: string; unsaved: boolean; config: MessageConfig | null; configError: string; showCopy?: boolean }) {
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<"" | "sms" | "email">("");
  const template = config?.templates[status];
  const values = orderValues(order, status);
  const labels = config?.variables ?? [];
  const shared = unsaved ? "Save the status first." : !config ? configError || "Message templates are still loading." : "";

  const whatsapp = fill(template?.whatsapp ?? "", values, labels);
  const number = whatsappNumber(order.phone);
  const whatsappBlock = shared || (!template?.whatsapp ? `There's no WhatsApp message for ${statusLabel(status)}. Add one in Settings.` : !number ? "This order has no valid phone number." : whatsapp.missing.length ? missingNote(whatsapp.missing) : "");

  const sms = fill(template?.sms ?? "", values, labels);
  const smsContentBlock = shared || (!template?.sms ? `There's no SMS message for ${statusLabel(status)}. Add one in Settings.` : !number ? "This order has no valid phone number." : sms.missing.length ? missingNote(sms.missing) : "");

  const subject = fill(template?.emailSubject ?? "", values, labels);
  const body = fill(template?.emailBody ?? "", values, labels);
  const emailMissing = [...new Set([...subject.missing, ...body.missing])];
  const email = order.email?.trim() ?? "";
  const emailValid = /^[^\s@]+@[^\s@]+$/.test(email);
  const mailto = emailValid ? mailLink(email, subject.text, body.text) : "";
  const contentBlock = shared || (!template?.emailBody ? `There's no email message for ${statusLabel(status)}. Add one in Settings.` : !emailValid ? "This order has no valid email address." : emailMissing.length ? missingNote(emailMissing) : "");
  const emailBlock = contentBlock || (mailto.length > MAX_EMAIL_LINK ? `This email is too long for the mail app to open. ${showCopy ? "Use Copy email" : "Use Copy email in View details"}, or shorten it in Settings.` : "");

  async function copy(kind: "sms" | "email") {
    try { await navigator.clipboard.writeText(kind === "sms" ? sms.text : `To: ${email}\nSubject: ${subject.text}\n\n${body.text}`); setCopied(kind); setNotice(""); window.setTimeout(() => setCopied(""), 2500); }
    catch { setNotice("Couldn't copy. Select the text in Settings instead."); }
  }
  const blocked = (label: string, icon: ReactNode, reason: string) => <button className="message-button blocked" type="button" aria-disabled="true" title={reason} onClick={() => setNotice(reason)}>{icon}{label}</button>;

  return <div className="message-actions">
    <div className="message-row">
      {whatsappBlock ? blocked("WhatsApp", <ChatIcon size={15} />, whatsappBlock) : <a className="message-button whatsapp" href={`https://wa.me/${number}?text=${encodeURIComponent(whatsapp.text)}`} target="_blank" rel="noreferrer" onClick={() => setNotice("")}><ChatIcon size={15} />WhatsApp</a>}
      {emailBlock ? blocked("Email", <MailIcon size={15} />, emailBlock) : <a className="message-button" href={mailto} onClick={() => setNotice("")}><MailIcon size={15} />Email</a>}
      {smsContentBlock ? blocked("SMS", <SmsIcon size={15} />, smsContentBlock) : <a className="message-button" href={`sms:+${number}?&body=${encodeURIComponent(sms.text)}`} onClick={() => setNotice("")}><SmsIcon size={15} />SMS</a>}
      {number ? <a className="message-button" href={`tel:+${number}`} onClick={() => setNotice("")}><PhoneIcon size={15} />Call</a> : blocked("Call", <PhoneIcon size={15} />, "This order has no valid phone number.")}
      {showCopy && !contentBlock && <button className="text-button" type="button" onClick={() => void copy("email")}>{copied === "email" ? "Copied" : "Copy email"}</button>}
      {showCopy && !smsContentBlock && <button className="text-button" type="button" onClick={() => void copy("sms")}>{copied === "sms" ? "Copied" : "Copy SMS"}</button>}
    </div>
    {notice && <small className="fulfillment-note" role="status">{notice}</small>}
  </div>;
}

type FieldKey = keyof MessageTemplate;
const FIELDS: { key: FieldKey; label: string; rows: number; max: number }[] = [
  { key: "whatsapp", label: "WhatsApp message", rows: 4, max: 1000 },
  { key: "sms", label: "SMS message", rows: 3, max: 320 },
  { key: "emailSubject", label: "Email subject", rows: 0, max: 150 },
  { key: "emailBody", label: "Email message", rows: 7, max: 1500 },
];
const SAMPLE: MessageOrder = { id: "ab12cd34", customer: "Customer Name", item: "Sample murti · 1", total: 1199, trackingNote: "Handed over today", trackingCourier: "trackon", trackingId: "TRACKING-ID" };

function TemplateEditor({ status, saved, defaults, variables, hidden, onSaved, onDirty }: { status: string; saved: MessageTemplate; defaults: MessageTemplate; variables: Variable[]; hidden: boolean; onSaved: (template: MessageTemplate) => void; onDirty: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const focused = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const focusedKey = useRef<FieldKey>("whatsapp");
  const fieldChanged = (key: FieldKey) => draft[key] !== saved[key];
  const dirty = FIELDS.some(field => fieldChanged(field.key));
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  function edit(key: FieldKey, value: string) { setDraft(current => ({ ...current, [key]: value })); setError(""); setMessage(""); }
  function insert(variable: string) {
    const key = focusedKey.current;
    const element = focused.current;
    const text = draft[key];
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    const token = `{${variable}}`;
    edit(key, text.slice(0, start) + token + text.slice(end));
    window.requestAnimationFrame(() => { element?.focus(); element?.setSelectionRange(start + token.length, start + token.length); });
  }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/order-messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, template: draft }) });
      const data = await response.json().catch(() => ({})) as { template?: MessageTemplate; error?: string };
      if (!response.ok || !data.template) throw new Error(data.error || "Could not save the template.");
      setDraft(data.template); onSaved(data.template); setMessage("Template saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the template."); }
    finally { setBusy(false); }
  }
  const sample = orderValues(SAMPLE, status);
  const preview = (key: FieldKey) => fill(draft[key], sample, variables).text;
  return <div className="template-editor" hidden={hidden}>
    <div className="template-variables" role="group" aria-label="Insert a variable">{variables.map(variable => <button className="template-chip variable" type="button" key={variable.key} onMouseDown={event => event.preventDefault()} onClick={() => insert(variable.key)}>{variable.label}</button>)}</div>
    {FIELDS.map(field => <label className={`template-field${fieldChanged(field.key) ? " changed" : ""}`} key={field.key}>{field.label}
      {field.rows ? <textarea rows={field.rows} maxLength={field.max} value={draft[field.key]} onFocus={event => { focused.current = event.target; focusedKey.current = field.key; }} onChange={event => edit(field.key, event.target.value)} />
        : <input maxLength={field.max} value={draft[field.key]} onFocus={event => { focused.current = event.target; focusedKey.current = field.key; }} onChange={event => edit(field.key, event.target.value)} />}
    </label>)}
    <div className="settings-preview template-preview" aria-label="Preview with sample details"><span className="overline">PREVIEW WITH SAMPLE DETAILS</span>
      <p><b>WhatsApp</b>{preview("whatsapp") || "No message"}</p>
      <p><b>SMS</b>{preview("sms") || "No message"}</p>
      <p><b>Email · {preview("emailSubject") || "No subject"}</b>{preview("emailBody") || "No message"}</p>
    </div>
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}
      <button className="text-button" type="button" disabled={busy || FIELDS.every(field => draft[field.key] === defaults[field.key])} onClick={() => { setDraft(defaults); setError(""); setMessage("Default text restored. Press Save to keep it."); }}>Reset to default</button>
      <button className="text-button" type="button" disabled={!dirty || busy} onClick={() => { setDraft(saved); setError(""); setMessage(""); }}>Undo</button>
      <button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save template"}</button>
    </div>
  </div>;
}

/** Settings panel: one set of templates per delivery status. Unsaved text stays when switching status. */
export function MessageTemplatesPanel() {
  const { config, error } = useMessageConfig();
  const [active, setActive] = useState<string>("unfulfilled");
  const [saved, setSaved] = useState<Templates | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const templates = saved ?? config?.templates;
  return <section className="panel settings-card" aria-labelledby="templates-title">
    <div className="panel-head"><div><p className="overline">ORDER UPDATES</p><h2 id="templates-title">Customer message templates</h2></div></div>
    <p className="muted">These fill in the WhatsApp, SMS and Email buttons on Orders for each delivery status. You check the message and press Send in that app.</p>
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {!config || !templates ? !error && <p className="muted">Loading templates…</p> : <>
      <div className="template-variables" role="group" aria-label="Choose a status">{STATUSES.map(([status, label]) => <button className={`template-chip${active === status ? " active" : ""}`} type="button" aria-pressed={active === status} key={status} onClick={() => setActive(status)}>{label}{dirty[status] ? " · unsaved" : ""}</button>)}</div>
      {STATUSES.map(([status]) => <TemplateEditor key={status} status={status} saved={templates[status]} defaults={config.defaults[status]} variables={config.variables} hidden={active !== status} onSaved={template => setSaved(current => ({ ...(current ?? config.templates), [status]: template }))} onDirty={value => setDirty(current => current[status] === value ? current : { ...current, [status]: value })} />)}
    </>}
  </section>;
}
