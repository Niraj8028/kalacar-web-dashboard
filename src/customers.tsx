import { useMemo, useState } from "react";
import { useLiveRefresh } from "./live";
import { DataTable, ModalDrawer, StatusChip } from "./dashboard-ui";
import { ChatIcon, CustomersIcon, MailIcon, PhoneIcon, RupeeIcon, SearchIcon, TrendIcon, OrdersIcon } from "./icons";

type Customer = { id: string; name: string; email: string; phone: string; google: boolean; isOwner: boolean; joined: string; paidOrders: number; allOrders: number; spent: number; refunded: number; lastOrder: string | null; city: string; pincode: string };
type CustomerDetail = {
  id: string; name: string; email: string; phone: string; google: boolean; isOwner: boolean; joined: string;
  totals: { paidOrders: number; allOrders: number; spent: number; refunded: number; firstOrder: string | null; lastOrder: string | null };
  addresses: { label: string; fullName: string; phone: string; address: string; city: string; state: string; pincode: string; isDefault: boolean }[];
  orders: { id: string; date: string; total: number; status: string; fulfillmentStatus: string; refundAmount: number | null; giftWrap: boolean; pincode: string; items: { name: string; colour: string; price: number; quantity: number }[] }[];
};
type Filter = "all" | "buyers" | "no_orders";
type Sort = "spent" | "orders" | "latest" | "newest";

const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";
const time = (value: string | null) => value ? new Date(value).getTime() : 0;
const digits = (phone: string) => phone.replace(/\D/g, "");
/** WhatsApp needs the country code; Indian 10-digit numbers get 91 in front. */
const whatsapp = (phone: string) => { const d = digits(phone); return d.length === 10 ? `91${d}` : d; };
const paymentLabels: Record<string, [string, "success" | "warning" | "danger" | "neutral"]> = {
  paid: ["Paid", "success"], refunded: ["Refunded", "neutral"], paid_after_cancel: ["Paid after cancel", "warning"],
  payment_pending: ["Awaiting payment", "warning"], payment_failed: ["Payment failed", "danger"], payment_setup_failed: ["Payment setup failed", "danger"],
  payment_cancelled: ["Cancelled", "neutral"], cancelled: ["Cancelled", "neutral"],
};
const deliveryLabels: Record<string, string> = { unfulfilled: "Not started", processing: "Preparing", dispatched: "Dispatched", completed: "Delivered" };
const filters: { key: Filter; label: string }[] = [{ key: "all", label: "All" }, { key: "buyers", label: "Buyers" }, { key: "no_orders", label: "Signed up, no order yet" }];

function GoogleMark() { return <span className="google-mark" title="Signs in with Google">Google</span>; }
function OwnerMark() { return <span className="google-mark owner-mark" title="Your owner account: shown for your own test orders, not counted in the summary">Owner</span>; }
const clock = (d: Date) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(d);
const LIVE_MS = 5000;

export function Customers({ onOpenOrder }: { onOpenOrder: (orderId: string) => void }) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("spent");
  const [openId, setOpenId] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useLiveRefresh(async () => {
    try {
      const response = await fetch("/api/admin/customers", { cache: "no-store" });
      const data = await response.json() as { customers?: Customer[]; error?: string };
      if (!response.ok || !data.customers) throw new Error(data.error || "Customers are temporarily unavailable.");
      setCustomers(data.customers); setError(""); setUpdatedAt(new Date());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Customers are temporarily unavailable."); }
  }, LIVE_MS, []);

  const all = useMemo(() => customers ?? [], [customers]);
  const real = all.filter(c => !c.isOwner);
  const ownerRows = all.filter(c => c.isOwner && c.allOrders > 0);
  const buyers = real.filter(c => c.paidOrders > 0);
  const paidOrders = buyers.reduce((s, c) => s + c.paidOrders, 0);
  const spent = buyers.reduce((s, c) => s + c.spent, 0);
  const allBuyers = all.filter(c => c.paidOrders > 0).length;
  const counts: Record<Filter, number> = { all: all.length, buyers: allBuyers, no_orders: all.length - allBuyers };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const rows = all.filter(c => (filter === "all" || (filter === "buyers" ? c.paidOrders > 0 : c.paidOrders === 0))
      && (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || (qDigits.length >= 3 && (digits(c.phone).includes(qDigits) || c.pincode.includes(qDigits)))));
    const by: Record<Sort, (a: Customer, b: Customer) => number> = {
      spent: (a, b) => b.spent - a.spent || b.paidOrders - a.paidOrders,
      orders: (a, b) => b.paidOrders - a.paidOrders || b.spent - a.spent,
      latest: (a, b) => time(b.lastOrder) - time(a.lastOrder),
      newest: (a, b) => time(b.joined) - time(a.joined),
    };
    return [...rows].sort((a, b) => by[sort](a, b) || time(b.joined) - time(a.joined));
  }, [all, filter, query, sort]);

  return <>
    <div className="page-heading"><div><p className="overline">PEOPLE</p><h1>Customers</h1><p className="muted">Everyone with a Kalacar account, and what they have bought.</p></div><span className="preview-pill live-pill" title="Refreshes every few seconds while this tab is open"><i /> {error && customers ? "Reconnecting…" : updatedAt ? `Live · ${clock(updatedAt)}` : "Connecting…"}</span></div>
    <section className="metrics customer-metrics" aria-label="Customer summary">
      <article className="metric-card"><span className="metric-icon"><CustomersIcon size={14} /></span><p>Customers</p><strong>{customers ? real.length : "—"}</strong><small>Accounts, excluding the owner</small></article>
      <article className="metric-card"><span className="metric-icon"><OrdersIcon size={14} /></span><p>Buyers</p><strong>{customers ? buyers.length : "—"}</strong><small>Paid for at least one order</small></article>
      <article className="metric-card"><span className="metric-icon"><TrendIcon size={14} /></span><p>Orders per buyer</p><strong>{customers ? (buyers.length ? (paidOrders / buyers.length).toFixed(1) : "0") : "—"}</strong><small>Average paid orders</small></article>
      <article className="metric-card"><span className="metric-icon"><RupeeIcon size={14} /></span><p>Spend per buyer</p><strong>{customers ? money(buyers.length ? spent / buyers.length : 0) : "—"}</strong><small>After refunds</small></article>
    </section>
    {ownerRows.map(c => <p className="owner-orders-note" key={c.id} role="note">Your owner account ({c.name || c.email}) has {c.paidOrders} paid {c.paidOrders === 1 ? "order" : "orders"} ({money(c.spent)}). It is listed below, but not counted in these totals.</p>)}
    <section className="panel customer-tools">
      <label className="customer-search"><SearchIcon size={15} /><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, phone or PIN" aria-label="Search customers" /></label>
      <div className="customer-filter-row">
        <div className="customer-filters" role="group" aria-label="Filter customers">{filters.map(f => <button type="button" key={f.key} className={filter === f.key ? "order-filter selected" : "order-filter"} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}<span>{customers ? counts[f.key] : "—"}</span></button>)}</div>
        <label className="customer-sort">Sort<select value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="spent">Most spent</option><option value="orders">Most orders</option><option value="latest">Latest order</option><option value="newest">Newest account</option></select></label>
      </div>
    </section>
    <section className="panel">{error && !customers ? <p className="empty-orders" role="alert">{error}</p> : !customers ? <p className="empty-orders">Loading customers…</p> : shown.length ? <DataTable rows={shown} rowKey={c => c.id} columns={[
      { key: "name", label: "Name", render: c => <button type="button" className="customer-name" onClick={() => setOpenId(c.id)}><b>{c.name || "No name"}</b>{c.google && <GoogleMark />}{c.isOwner && <OwnerMark />}</button> },
      { key: "contact", label: "Contact", render: c => <div className="customer-contact"><a href={`mailto:${c.email}`}>{c.email}</a>{c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}</div> },
      { key: "place", label: "City / PIN", render: c => <span>{[c.city, c.pincode].filter(Boolean).join(" · ") || "—"}</span> },
      { key: "orders", label: "Orders", render: c => <span>{c.paidOrders}</span> },
      { key: "spent", label: "Total spent", render: c => <b>{money(c.spent)}</b> },
      { key: "last", label: "Last order", render: c => <span>{date(c.lastOrder)}</span> },
      { key: "joined", label: "Joined", render: c => <span>{date(c.joined)}</span> },
      { key: "open", label: "", render: c => <button type="button" className="text-button" onClick={() => setOpenId(c.id)}>View</button> },
    ]} /> : <p className="empty-orders">{all.length ? "No customers match this search or filter." : "No customer accounts yet."}</p>}</section>
    <ModalDrawer open={Boolean(openId)} title="Customer details" onClose={() => setOpenId("")}>{openId && <CustomerPanel key={openId} id={openId} onOpenOrder={id => { setOpenId(""); onOpenOrder(id); }} />}</ModalDrawer>
  </>;
}

function CustomerPanel({ id, onOpenOrder }: { id: string; onOpenOrder: (orderId: string) => void }) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState("");
  useLiveRefresh(async () => {
    try {
      const response = await fetch(`/api/admin/customers/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json() as { customer?: CustomerDetail; error?: string };
      if (!response.ok || !data.customer) throw new Error(data.error || "Customer details are temporarily unavailable.");
      setDetail(data.customer); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Customer details are temporarily unavailable."); }
  }, LIVE_MS, [id]);
  if (error && !detail) return <p role="alert" className="order-detail-error">{error}</p>;
  if (!detail) return <p role="status">Loading customer…</p>;
  const t = detail.totals;
  return <div className="order-detail-content">
    <div className="customer-head"><b>{detail.name || "No name"}</b>{detail.google && <GoogleMark />}{detail.isOwner && <OwnerMark />}<small>Joined {date(detail.joined)}</small></div>
    <div className="contact-buttons">
      <a className="secondary" href={`mailto:${detail.email}`}><MailIcon size={15} /> Email</a>
      {detail.phone && <a className="secondary" href={`tel:${detail.phone}`}><PhoneIcon size={15} /> Call</a>}
      {detail.phone && <a className="secondary" href={`https://wa.me/${whatsapp(detail.phone)}`} target="_blank" rel="noreferrer"><ChatIcon size={15} /> WhatsApp</a>}
    </div>
    <div className="order-detail-summary"><div><span>Email</span><a href={`mailto:${detail.email}`}>{detail.email}</a></div><div><span>Phone</span>{detail.phone ? <a href={`tel:${detail.phone}`}>{detail.phone}</a> : <b>Not given</b>}</div></div>
    <section className="order-detail-section"><h3>Totals</h3><dl className="customer-totals">
      <div><dt>Lifetime spend</dt><dd>{money(t.spent)}</dd></div><div><dt>Paid orders</dt><dd>{t.paidOrders}{t.allOrders > t.paidOrders && <small> of {t.allOrders} placed</small>}</dd></div>
      <div><dt>Refunds</dt><dd>{money(t.refunded)}</dd></div><div><dt>First order</dt><dd>{date(t.firstOrder)}</dd></div><div><dt>Last order</dt><dd>{date(t.lastOrder)}</dd></div>
    </dl></section>
    <section className="order-detail-section"><h3>Saved addresses</h3>{detail.addresses.length ? <div className="customer-addresses">{detail.addresses.map((a, i) => <address key={i}><b>{a.label || a.fullName}{a.isDefault && <StatusChip tone="success">Default</StatusChip>}</b>{a.fullName}{a.phone && <> · {a.phone}</>}<br />{a.address}<br />{[a.city, a.state].filter(Boolean).join(", ")} {a.pincode}</address>)}</div> : <p>No saved addresses.</p>}</section>
    <section className="order-detail-section"><h3>Order history</h3>{detail.orders.length ? <div className="customer-orders">{detail.orders.map(o => { const [label, tone] = paymentLabels[o.status] ?? [o.status.replaceAll("_", " "), "neutral" as const]; return <button type="button" className="customer-order" key={o.id} onClick={() => onOpenOrder(o.id)} aria-label={`Open order ${o.id.slice(0, 8)}`}>
      <span className="customer-order-top"><b>{date(o.date)}</b><small>{o.id.slice(0, 8)}</small><strong>{money(o.total)}</strong></span>
      <span className="customer-order-items">{o.items.map((item, i) => <span key={i}>{item.quantity} × {item.name}{item.colour && <em className="order-item-colour">{item.colour}</em>}</span>)}{o.giftWrap && <span>Gift-ready packaging</span>}</span>
      <span className="customer-order-status"><StatusChip tone={tone}>{label}</StatusChip>{["paid", "refunded"].includes(o.status) && <StatusChip tone="neutral">{deliveryLabels[o.fulfillmentStatus] ?? o.fulfillmentStatus}</StatusChip>}{o.refundAmount ? <small>Refunded {money(o.refundAmount)}</small> : null}</span>
    </button>; })}</div> : <p>No orders yet.</p>}</section>
  </div>;
}
