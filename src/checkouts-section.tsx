import { useEffect, useMemo, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { StatusChip } from "./dashboard-ui";
import { MessageButtons, useMessageConfig } from "./messages";

type Line = { name: string; colour: string; quantity: number; price: number };
type Lead = { id: string; name: string; phone: string; email: string; pincode: string; items: Line[]; total: number; contacted: boolean; createdAt: string; updatedAt: string; outcome: "paid" | "unpaid" | "none"; orderId: string | null };
type Feedback = { id: number; leadId: string | null; reasons: string[]; other: string; source: string; createdAt: string };
type Data = { leads: Lead[]; feedback: Feedback[]; reasons: { key: string; label: string }[] };
type Filter = "none" | "unpaid" | "paid" | "all";

const FILTERS: { key: Filter; label: string }[] = [{ key: "none", label: "Left before paying" }, { key: "unpaid", label: "Order not paid" }, { key: "paid", label: "Paid later" }, { key: "all", label: "All" }];
const OUTCOME: Record<Lead["outcome"], { label: string; tone: "warning" | "danger" | "success" }> = { none: { label: "Left before paying", tone: "warning" }, unpaid: { label: "Order not paid", tone: "danger" }, paid: { label: "Paid", tone: "success" } };
const SOURCE: Record<string, string> = { payment: "closed the payment window", back: "pressed Back", mouse: "moved to leave the page" };
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const rupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/**
 * Shoppers who typed a name and mobile number at checkout in the last 30 days, matched to any order from the same number,
 * with a ready WhatsApp message for those who didn't pay. Above them, why people said they left.
 */
export function CheckoutsSection({ onOpenOrder }: { onOpenOrder: (id: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("none");
  const { config, error: configError } = useMessageConfig();
  useEffect(() => {
    let active = true;
    getJson<Data>("/api/admin/checkout-leads", "Checkouts are unavailable right now.").then(next => { if (active) { setData(next); setError(""); } }).catch(cause => { if (active) setError(errorText(cause, "Checkouts are unavailable right now.")); });
    return () => { active = false; };
  }, []);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const answer of data?.feedback ?? []) for (const reason of answer.reasons) result.set(reason, (result.get(reason) ?? 0) + 1);
    return result;
  }, [data]);
  // Ticks at once; goes back if the save fails.
  async function toggle(lead: Lead) {
    const mark = (contacted: boolean) => setData(current => current && { ...current, leads: current.leads.map(other => other.id === lead.id ? { ...other, contacted } : other) });
    mark(!lead.contacted);
    try { await sendJson(`/api/admin/checkout-leads/${lead.id}`, "PATCH", { contacted: !lead.contacted }); }
    catch (cause) { mark(lead.contacted); setError(errorText(cause, "Could not save.")); }
  }
  const leads = (data?.leads ?? []).filter(lead => filter === "all" || lead.outcome === filter);
  const answers = data?.feedback.length ?? 0;
  const most = Math.max(1, ...counts.values());
  return <>
    <div className="page-heading"><div><p className="overline">LAST 30 DAYS</p><h1>Checkouts</h1><p className="muted">People who typed their name and mobile number at checkout. Message the ones who didn't pay: a short, friendly WhatsApp often brings the order back.</p></div></div>
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    <section className="panel settings-card" aria-labelledby="leave-reasons-title">
      <div className="panel-head"><div><p className="overline">LEAVING SURVEY</p><h2 id="leave-reasons-title">Why people left checkout</h2></div><StatusChip tone="neutral">{answers} answer{answers === 1 ? "" : "s"}</StatusChip></div>
      {!data ? !error && <p className="muted">Loading…</p> : !answers ? <p className="muted">No answers yet. The question appears once per visit when someone closes the payment window or leaves checkout.</p> : <>
        <ul className="reason-bars">{data.reasons.map(reason => { const count = counts.get(reason.key) ?? 0; return <li key={reason.key}><span>{reason.label}</span><span className="reason-bar" aria-hidden="true"><i style={{ width: `${(count / most) * 100}%` }} /></span><b>{count}</b></li>; })}</ul>
        {data.feedback.some(answer => answer.other) && <><h3 className="reason-notes-title">In their words</h3><ul className="reason-notes">{data.feedback.filter(answer => answer.other).slice(0, 20).map(answer => <li key={answer.id}>“{answer.other}”<small>{when(answer.createdAt)}{SOURCE[answer.source] ? ` · ${SOURCE[answer.source]}` : ""}</small></li>)}</ul></>}
      </>}
    </section>
    <section className="panel order-filters" role="group" aria-label="Show checkouts">{FILTERS.map(item => <button key={item.key} type="button" className={filter === item.key ? "order-filter selected" : "order-filter"} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}<span>{data ? data.leads.filter(lead => item.key === "all" || lead.outcome === item.key).length : "—"}</span></button>)}</section>
    <section className="panel editor-list">{!data ? !error && <p className="empty-orders">Loading checkouts…</p> : !leads.length ? <p className="empty-orders">Nothing here.</p> : leads.map(lead => <article className={lead.contacted ? "editor-list-row handled checkout-lead" : "editor-list-row checkout-lead"} key={lead.id}>
      <div>
        <div className="checkout-lead-head"><b>{lead.name}</b><StatusChip tone={OUTCOME[lead.outcome].tone}>{OUTCOME[lead.outcome].label}</StatusChip></div>
        <small>{when(lead.updatedAt)} · <a href={`tel:+91${lead.phone}`}>+91 {lead.phone}</a>{lead.email && <> · <a href={`mailto:${lead.email}`}>{lead.email}</a></>}{lead.pincode && ` · PIN ${lead.pincode}`}</small>
        <p className="checkout-lead-items">{lead.items.map(line => `${line.name}${line.colour && line.colour !== "Standard" ? ` (${line.colour})` : ""} × ${line.quantity}`).join(", ")} · <b>{rupees(lead.total)}</b></p>
        {lead.orderId && <button type="button" className="text-button" onClick={() => onOpenOrder(lead.orderId!)}>Open the order</button>}
        {lead.outcome !== "paid" && <MessageButtons order={{ id: lead.id, customer: lead.name, phone: lead.phone, email: lead.email, total: lead.total, items: lead.items.map(line => ({ name: line.name, variant: line.colour, quantity: line.quantity })) }} status="abandoned" unsaved={false} config={config} configError={configError} showCopy />}
      </div>
      <label className="address-check"><input type="checkbox" checked={lead.contacted} onChange={() => void toggle(lead)} />Contacted</label>
    </article>)}</section>
  </>;
}
