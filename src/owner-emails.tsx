import { useEffect, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { Check, TextField } from "./editor-fields";

type OwnerEmails = { emails: string[]; paid: boolean; unpaid: boolean };
type Draft = { emails: string; paid: boolean; unpaid: boolean };
const DEFAULT: OwnerEmails = { emails: [], paid: true, unpaid: true };
const toDraft = (value: OwnerEmails): Draft => ({ emails: value.emails.join(", "), paid: value.paid, unpaid: value.unpaid });
const same = (a: Draft, b: Draft) => a.emails.trim() === b.emails.trim() && a.paid === b.paid && a.unpaid === b.unpaid;

/** Who gets an email for each new order, and for which orders. The shop sends them; this only saves the choice. */
export function OwnerEmailsPanel() {
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft(DEFAULT));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    getJson<{ ownerEmails?: Partial<OwnerEmails> }>("/api/admin/settings", "Settings are unavailable right now.")
      .then(data => { if (active) { const value = toDraft({ ...DEFAULT, ...data.ownerEmails }); setSaved(value); setDraft(value); } })
      .catch(cause => { if (active) setError(errorText(cause, "Settings are unavailable right now.")); });
    return () => { active = false; };
  }, []);
  const change = (next: Partial<Draft>) => { setDraft(current => ({ ...current, ...next })); setError(""); setMessage(""); };
  const dirty = saved !== null && !same(draft, saved);
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await sendJson<{ ownerEmails: OwnerEmails }>("/api/admin/settings", "PATCH", { ownerEmails: { emails: draft.emails, paid: draft.paid, unpaid: draft.unpaid } });
      const value = toDraft({ ...DEFAULT, ...data.ownerEmails });
      setSaved(value); setDraft(value);
      setMessage(value.emails ? "Saved. The next order will be emailed to these addresses." : "Saved. No order emails will be sent.");
    } catch (cause) { setError(errorText(cause, "Could not save the order emails.")); }
    finally { setBusy(false); }
  }
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="owner-emails-title">
    <div className="panel-head"><div><p className="overline">FOR YOU</p><h2 id="owner-emails-title">Order emails to you</h2></div></div>
    {saved === null ? !error && <p className="muted">Loading…</p> : <div className="setting-stack">
      <TextField label="Send order emails to" value={draft.emails} max={1000} placeholder="you@gmail.com, partner@gmail.com" onChange={emails => change({ emails })} hint="Up to 5 addresses, separated by commas. Each email has the customer's name, phone, email, address and items, and a WhatsApp message ready to send them." />
      <Check label="Email me every paid order" checked={draft.paid} onChange={paid => change({ paid })} hint="Sent as soon as the payment is confirmed. The WhatsApp message is your “Not started” customer message below." />
      <Check label="Email me orders that weren't paid" checked={draft.unpaid} onChange={unpaid => change({ unpaid })} hint="Sent when the customer cancels, or when an order is still unpaid after 1 hour. The WhatsApp message is your “Not paid” customer message below." />
      <p className="muted">Emails go out from the shop's mailbox (SMTP settings on the server). If none arrive, check the spam folder, then check those settings.</p>
    </div>}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    {saved !== null && <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="text-button" type="button" disabled={!dirty || busy} onClick={() => setDraft(saved)}>Undo</button><button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button></div>}
  </section>;
}
