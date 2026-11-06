import { useEffect, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { StatusChip } from "./dashboard-ui";
import { useLiveRevision } from "./realtime";

type Inquiry = { id: number; name: string; email: string; phone: string; message: string; handled: boolean; createdAt: string };

export function InquiriesSection() {
  const [items, setItems] = useState<Inquiry[] | null>(null);
  const [error, setError] = useState("");
  const revision = useLiveRevision(true, "inquiries");
  useEffect(() => {
    let active = true;
    getJson<{ inquiries: Inquiry[] }>("/api/admin/inquiries", "Messages are unavailable right now.").then(data => { if (active) { setItems(data.inquiries); setError(""); } }).catch(cause => { if (active) setError(errorText(cause, "Messages are unavailable right now.")); });
    return () => { active = false; };
  }, [revision]);
  async function toggle(item: Inquiry) {
    try { await sendJson(`/api/admin/inquiries/${item.id}`, "PATCH", { handled: !item.handled }); setItems(current => current?.map(other => other.id === item.id ? { ...other, handled: !item.handled } : other) ?? null); }
    catch (cause) { setError(errorText(cause, "Could not save.")); }
  }
  async function remove(id: number) {
    if (!window.confirm("Delete this message?")) return;
    try { await sendJson(`/api/admin/inquiries/${id}`, "DELETE"); setItems(current => current?.filter(other => other.id !== id) ?? null); }
    catch (cause) { setError(errorText(cause, "Could not delete.")); }
  }
  return <>
    <div className="page-heading"><div><p className="overline">CUSTOMERS</p><h1>Inquiries</h1><p className="muted">Messages sent from your Contact page.</p></div></div>
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    <section className="panel editor-list">{!items ? !error && <p className="empty-orders">Loading messages…</p> : !items.length ? <p className="empty-orders">No messages yet.</p> : items.map(item => <article className={item.handled ? "editor-list-row handled" : "editor-list-row"} key={item.id}>
      <div><b>{item.name}</b><small>{new Date(item.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</small><p className="inquiry-message">{item.message}</p><small><a href={`mailto:${encodeURIComponent(item.email).replace("%40", "@")}`}>{item.email}</a>{item.phone && <> · <a href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}>{item.phone}</a></>}</small></div>
      <div className="editor-list-actions">{item.handled ? <StatusChip tone="success">Handled</StatusChip> : <StatusChip tone="warning">New</StatusChip>}<button className="secondary" type="button" onClick={() => void toggle(item)}>{item.handled ? "Mark as new" : "Mark handled"}</button><button className="text-button" type="button" onClick={() => void remove(item.id)}>Delete</button></div>
    </article>)}</section>
  </>;
}
