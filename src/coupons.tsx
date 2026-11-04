import { useState } from "react";
import type { FormEvent } from "react";
import { DataTable, ModalDrawer, StatusChip } from "./dashboard-ui";
import { useLiveRefresh } from "./live";

type CouponType = "percent" | "fixed";
type CouponStatus = "active" | "scheduled" | "expired" | "used_up" | "off";
type Coupon = { id: number; code: string; type: CouponType; amount: number; maxDiscount: number | null; minSpend: number; usageLimit: number | null; oncePerCustomer: boolean; startsOn: string | null; expiresOn: string | null; active: boolean; uses: number; paidUses: number; discountGiven: number; status: CouponStatus; description: string };
type Draft = { code: string; type: CouponType; amount: string; maxDiscount: string; minSpend: string; usageLimit: string; oncePerCustomer: boolean; startsOn: string; expiresOn: string; active: boolean };
type Filter = "all" | "active" | "scheduled" | "ended" | "off";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const day = (d: string | null) => d ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : "";
const statusInfo: Record<CouponStatus, [string, "success" | "warning" | "danger" | "neutral"]> = { active: ["Active", "success"], scheduled: ["Scheduled", "warning"], expired: ["Expired", "neutral"], used_up: ["Used up", "neutral"], off: ["Off", "neutral"] };
const filters: { key: Filter; label: string; match: (c: Coupon) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "active", label: "Active", match: c => c.status === "active" },
  { key: "scheduled", label: "Scheduled", match: c => c.status === "scheduled" },
  { key: "ended", label: "Expired or used up", match: c => c.status === "expired" || c.status === "used_up" },
  { key: "off", label: "Off", match: c => c.status === "off" },
];
const blank: Draft = { code: "", type: "percent", amount: "", maxDiscount: "", minSpend: "", usageLimit: "", oncePerCustomer: true, startsOn: "", expiresOn: "", active: true };
const toDraft = (c: Coupon): Draft => ({ code: c.code, type: c.type, amount: String(c.amount), maxDiscount: c.maxDiscount ? String(c.maxDiscount) : "", minSpend: c.minSpend ? String(c.minSpend) : "", usageLimit: c.usageLimit ? String(c.usageLimit) : "", oncePerCustomer: c.oncePerCustomer, startsOn: c.startsOn ?? "", expiresOn: c.expiresOn ?? "", active: c.active });
/** Random code without look-alike characters (0/O, 1/I). */
const generateCode = () => { const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const pick = new Uint32Array(4); crypto.getRandomValues(pick); return `KALA-${[...pick].map(n => chars[n % chars.length]).join("")}`; };
function preview(d: Draft) {
  const amount = Number(d.amount) || 0;
  if (!amount) return "Enter an amount to see what customers will get.";
  const base = d.type === "percent" ? `${amount}% off murtis${Number(d.maxDiscount) ? ` (up to ${money(Number(d.maxDiscount))})` : ""}` : `${money(amount)} off murtis`;
  return `${base}${Number(d.minSpend) ? ` on orders of ${money(Number(d.minSpend))} or more` : ""}. Gift packaging isn't discounted.`;
}

export function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [toggling, setToggling] = useState(0);

  async function load() {
    try {
      const response = await fetch("/api/admin/coupons", { cache: "no-store" });
      const data = await response.json() as { coupons?: Coupon[]; error?: string };
      if (!response.ok || !data.coupons) throw new Error(data.error || "Coupons are temporarily unavailable.");
      setCoupons(data.coupons); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Coupons are temporarily unavailable."); }
  }
  useLiveRefresh(load, 5000, []);

  async function toggle(c: Coupon) {
    setToggling(c.id); setMessage("");
    try {
      const response = await fetch(`/api/admin/coupons/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !c.active }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not change the coupon.");
      setMessage(c.active ? `${c.code} is off. Customers can't use it now.` : `${c.code} is on.`);
      await load();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not change the coupon."); }
    finally { setToggling(0); }
  }

  const all = coupons ?? [];
  const shown = all.filter(filters.find(f => f.key === filter)!.match);
  return <>
    <div className="page-heading"><div><p className="overline">PROMOTIONS</p><h1>Coupons</h1><p className="muted">Discount codes customers can enter in their bag. Discounts apply to murtis, not gift packaging.</p></div><button className="primary" type="button" onClick={() => { setEditing("new"); setMessage(""); }}>New coupon</button></div>
    <section className="panel order-filters" role="group" aria-label="Filter coupons">{filters.map(f => <button type="button" key={f.key} className={filter === f.key ? "order-filter selected" : "order-filter"} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}<span>{coupons ? all.filter(f.match).length : "—"}</span></button>)}</section>
    {message && <p className="coupon-message" role="status">{message}</p>}
    <section className="panel">{error && !coupons ? <p className="empty-orders" role="alert">{error}</p> : !coupons ? <p className="empty-orders">Loading coupons…</p> : shown.length ? <DataTable rows={shown} rowKey={c => String(c.id)} columns={[
      { key: "code", label: "Code", render: c => <button type="button" className="coupon-code-cell" onClick={() => { setEditing(c); setMessage(""); }}><b>{c.code}</b><small>{c.description}</small></button> },
      { key: "uses", label: "Used", render: c => <span title={`${c.paidUses} paid · ${money(c.discountGiven)} given`}>{c.uses}{c.usageLimit ? ` / ${c.usageLimit}` : ""}{c.oncePerCustomer && <small className="table-muted"> · 1 each</small>}</span> },
      { key: "dates", label: "Dates", render: c => <span className="table-muted">{c.startsOn || c.expiresOn ? `${c.startsOn ? day(c.startsOn) : "Now"} – ${c.expiresOn ? day(c.expiresOn) : "no end"}` : "No end date"}</span> },
      { key: "given", label: "Discount given", render: c => <span>{money(c.discountGiven)}</span> },
      { key: "status", label: "Status", render: c => <StatusChip tone={statusInfo[c.status][1]}>{statusInfo[c.status][0]}</StatusChip> },
      { key: "actions", label: "Actions", render: c => <div className="order-actions"><label className="coupon-switch"><input type="checkbox" checked={c.active} disabled={toggling === c.id} onChange={() => void toggle(c)} aria-label={`${c.code} ${c.active ? "on" : "off"}`} /><span>{c.active ? "On" : "Off"}</span></label><button type="button" className="text-button" onClick={() => { setEditing(c); setMessage(""); }}>Edit</button></div> },
    ]} /> : <p className="empty-orders">{all.length ? "No coupons match this filter." : "No coupons yet. Create one with New coupon."}</p>}</section>
    <ModalDrawer open={editing !== null} title={editing === "new" ? "New coupon" : "Edit coupon"} onClose={() => setEditing(null)}>{editing !== null && <CouponEditor key={editing === "new" ? "new" : editing.id} coupon={editing === "new" ? null : editing} onDone={async (text) => { setEditing(null); setMessage(text); await load(); }} />}</ModalDrawer>
  </>;
}

function CouponEditor({ coupon, onDone }: { coupon: Coupon | null; onDone: (message: string) => void }) {
  const [draft, setDraft] = useState<Draft>(() => coupon ? toDraft(coupon) : { ...blank, code: generateCode() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<Draft>) => { setDraft(d => ({ ...d, ...patch })); setError(""); };
  const used = (coupon?.uses ?? 0) > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const body = { ...draft, maxDiscount: draft.type === "percent" ? draft.maxDiscount : "" };
      const response = await fetch(coupon ? `/api/admin/coupons/${coupon.id}` : "/api/admin/coupons", { method: coupon ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the coupon.");
      onDone(coupon ? `Saved ${draft.code.toUpperCase()}.` : `Created ${draft.code.toUpperCase()}.${draft.active ? " Customers can use it now." : " It's off until you switch it on."}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the coupon."); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!coupon || !window.confirm(`Delete ${coupon.code}? This can't be undone.`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete the coupon.");
      onDone(`Deleted ${coupon.code}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete the coupon."); setSaving(false); }
  }

  return <form className="coupon-editor" onSubmit={submit} noValidate>
    <label className="coupon-field"><span>Code</span><div className="coupon-code-row"><input value={draft.code} onChange={e => set({ code: e.target.value.toUpperCase().replace(/\s+/g, "") })} maxLength={32} autoComplete="off" spellCheck={false} required /><button type="button" className="secondary" onClick={() => set({ code: generateCode() })}>Generate</button></div><small>Customers type this in their bag. Letters, numbers and dashes; capitals don't matter.{used && " Orders that used it keep the old code."}</small></label>
    <fieldset className="coupon-type"><legend>Discount type</legend>
      <label className={draft.type === "percent" ? "selected" : ""}><input type="radio" name="coupon-type" checked={draft.type === "percent"} onChange={() => set({ type: "percent" })} />Percentage off</label>
      <label className={draft.type === "fixed" ? "selected" : ""}><input type="radio" name="coupon-type" checked={draft.type === "fixed"} onChange={() => set({ type: "fixed" })} />Fixed ₹ off</label>
    </fieldset>
    <div className="coupon-grid">
      <label className="coupon-field"><span>{draft.type === "percent" ? "Discount (%)" : "Discount (₹)"}</span><input inputMode="numeric" value={draft.amount} onChange={e => set({ amount: e.target.value.replace(/\D/g, "") })} placeholder={draft.type === "percent" ? "10" : "100"} required /></label>
      {draft.type === "percent" && <label className="coupon-field"><span>Maximum discount (₹)</span><input inputMode="numeric" value={draft.maxDiscount} onChange={e => set({ maxDiscount: e.target.value.replace(/\D/g, "") })} placeholder="No maximum" /></label>}
      <label className="coupon-field"><span>Minimum spend on murtis (₹)</span><input inputMode="numeric" value={draft.minSpend} onChange={e => set({ minSpend: e.target.value.replace(/\D/g, "") })} placeholder="None" /></label>
      <label className="coupon-field"><span>Total uses allowed</span><input inputMode="numeric" value={draft.usageLimit} onChange={e => set({ usageLimit: e.target.value.replace(/\D/g, "") })} placeholder="No limit" /></label>
      <label className="coupon-field"><span>Starts on</span><input type="date" value={draft.startsOn} onChange={e => set({ startsOn: e.target.value })} /><small>Empty: from today</small></label>
      <label className="coupon-field"><span>Expires after</span><input type="date" value={draft.expiresOn} min={draft.startsOn || undefined} onChange={e => set({ expiresOn: e.target.value })} /><small>Empty: never. Works until the end of this day (India time).</small></label>
    </div>
    <label className="toggle-row"><input type="checkbox" checked={draft.oncePerCustomer} onChange={e => set({ oncePerCustomer: e.target.checked })} /><span><b>Once per customer</b><small>Each account can use this coupon on one order.</small></span></label>
    <label className="toggle-row"><input type="checkbox" checked={draft.active} onChange={e => set({ active: e.target.checked })} /><span><b>Coupon is on</b><small>Switch off to stop new orders using it. Orders already placed keep their discount.</small></span></label>
    <p className="coupon-preview"><span className="overline">CUSTOMERS SEE</span>{preview(draft)}</p>
    {coupon && <p className="field-hint">Used on {coupon.uses} {coupon.uses === 1 ? "order" : "orders"} so far ({coupon.paidUses} paid, {money(coupon.discountGiven)} given). A use returns if payment setup fails or the order is cancelled; refunds don't return it.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="coupon-actions">
      {coupon && (used ? <small className="field-hint">Used coupons can't be deleted — switch it off instead.</small> : <button type="button" className="secondary danger" disabled={saving} onClick={() => void remove()}>Delete coupon</button>)}
      <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : coupon ? "Save coupon" : "Create coupon"}</button>
    </div>
  </form>;
}
