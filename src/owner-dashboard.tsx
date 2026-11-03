import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { DataTable, FormField, ModalDrawer, StatusChip } from "./dashboard-ui";

type Product = { id: string; name: string; deity: string; image: string; price: number; stock: number };
type Order = { id: string; date: string; customer: string; item: string; total: number; status: string; fulfillmentStatus?: string; email?: string; phone?: string; address?: string; pincode?: string };
type AdminMetrics = { todayRevenue: number; monthRevenue: number; totalOrders: number; paidOrders: number; averageOrderValue: number; lowStockProducts: number; outOfStockProducts: number; lowStockThreshold: number; fulfillmentNeeded: number; paymentRecovery: number };
type Section = "Overview" | "Orders" | "Products" | "Customers" | "Coupons" | "Settings";
const sections: Section[] = ["Overview", "Orders", "Products", "Customers", "Coupons", "Settings"];

async function loadAdminMetrics() {
  const response = await fetch("/api/admin/metrics", { cache: "no-store" });
  const data = await response.json() as AdminMetrics & { error?: string };
  if (!response.ok) throw new Error(data.error || "Dashboard metrics are temporarily unavailable.");
  return data;
}

const initialProducts: Product[] = [
  { id: "ganpati", name: "Ganpati Murti", deity: "Ganpati", image: "/images/catalogue/ganpati/ganpati-01.jpeg", price: 599, stock: 8 },
  { id: "sri-krishna", name: "Sri Krishna Murti", deity: "Sri Krishna", image: "/images/catalogue/sri-krishna/sri-krishna-07.webp", price: 699, stock: 5 },
  { id: "swami-samarth", name: "Swami Samarth Murti", deity: "Swami Samarth", image: "/images/catalogue/swami-samarth/swami-samarth-01.jpeg", price: 749, stock: 0 },
];
const demoOrders: Order[] = [
  { id: "DEMO-1042", date: "Today · 10:24 am", customer: "Aarav P.", item: "Ganpati Murti · 1", total: 599, status: "New" },
  { id: "DEMO-1041", date: "Yesterday · 4:12 pm", customer: "Meera S.", item: "Sri Krishna Murti · 1", total: 699, status: "Preparing" },
];

export default function Dashboard() {
  const [signedIn, setSignedIn] = useState(false);
  const [section, setSection] = useState<Section>("Overview");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(() => window.sessionStorage.getItem("kalacar-dashboard-banner-dismissed") !== "yes");
  const [products, setProducts] = useState(initialProducts);
  const [savedProducts, setSavedProducts] = useState(initialProducts);
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasLiveOrders, setHasLiveOrders] = useState(false);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [metricsError, setMetricsError] = useState("");
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingOrder, setSavingOrder] = useState("");

  async function refreshProducts() {
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      const data = await response.json() as { products: Product[] };
      setProducts(data.products);
      setSavedProducts(data.products);
      setApiError("");
    } catch {
      setApiError("Shared inventory database is unavailable. Displaying preview values.");
    }
  }

  useEffect(() => {
    void refreshProducts();
    if (section === "Products") return;
    const timer = window.setInterval(() => void refreshProducts(), 2500);
    return () => window.clearInterval(timer);
  }, [section]);

  useEffect(() => {
    let active = true;
    const refreshOrders = async () => {
      try {
        const response = await fetch("/api/admin/orders", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { orders: Order[] };
        if (active) { setOrders(data.orders); setHasLiveOrders(true); }
      } catch { /* Keep the page usable while local order history loads. */ }
    };
    void refreshOrders();
    const timer = window.setInterval(refreshOrders, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    const refreshMetrics = async () => {
      try {
        const result = await loadAdminMetrics();
        if (active) { setMetrics(result); setMetricsError(""); }
      } catch (error) {
        if (active) setMetricsError(error instanceof Error ? error.message : "Dashboard metrics are temporarily unavailable.");
      } finally {
        if (active) setMetricsLoading(false);
      }
    };
    void refreshMetrics();
    const timer = window.setInterval(refreshMetrics, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setCommandOpen(true); setCommandQuery("");
      }
      if (event.key === "Escape") { setCommandOpen(false); setProfileOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function updateOrder(id: string, fulfillmentStatus: string) {
    setSavingOrder(id); setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fulfillmentStatus }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not update order.");
      const refreshed = await fetch("/api/admin/orders", { cache: "no-store" });
      if (!refreshed.ok) throw new Error("Status saved, but the order list could not refresh.");
      const result = await refreshed.json() as { orders: Order[] };
      setOrders(result.orders);
      try {
        const refreshedMetrics = await loadAdminMetrics();
        setMetrics(refreshedMetrics); setMetricsError("");
      } catch (error) {
        setMetricsError(error instanceof Error ? error.message : "Dashboard metrics are temporarily unavailable.");
      }
      setMessage("Order progress updated for the customer account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update order.");
    } finally {
      setSavingOrder("");
      window.setTimeout(() => setMessage(""), 4500);
    }
  }

  async function saveProducts(nextProducts: Product[]) {
    setSaving(true);
    setMessage("");
    try {
      for (const product of nextProducts) {
        const original = savedProducts.find(item => item.id === product.id);
        if (!original || (original.price === product.price && original.stock === product.stock)) continue;
        const update: { price?: number; stock?: number } = {};
        if (original.price !== product.price) update.price = product.price;
        if (original.stock !== product.stock) update.stock = product.stock;
        const response = await fetch(`/api/admin/products/${product.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        });
        if (!response.ok) throw new Error("Save failed");
      }
      await refreshProducts();
      setMessage("Saved to the shared Kalacar inventory.");
    } catch {
      setMessage("Could not save. Check the storefront server and temporary database connection.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setMessage(""), 4000);
    }
  }

  // This mock gate intentionally works only in Vite's development server.
  // Production remains locked until server-backed owner auth is implemented.
  if (!import.meta.env.DEV) return <main className="locked"><span className="brand-mark">k.</span><h1>Owner access is not configured</h1><p>Real owner authentication must be enabled before this dashboard can be used outside local development.</p></main>;

  if (!signedIn) return <main className="login-shell"><section className="login-card">
    <span className="brand-mark">k.</span><p className="overline">KALACAR · LOCAL PREVIEW</p><h1>Welcome back</h1>
    <p className="muted">Sign in to your small shop dashboard.</p>
    <label>Email address<input type="email" defaultValue="owner@kalacar.local" /></label>
    <label>Password<input type="password" defaultValue="local-preview" /></label>
    <button className="primary wide" onClick={() => setSignedIn(true)}>Sign in to local preview <span>→</span></button>
    <p className="demo-note">Demo sign-in · no account or password is checked. Local development only.</p>
  </section></main>;

  const todayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase();
  const visibleOrders = hasLiveOrders ? orders : demoOrders;
  const pendingCount = visibleOrders.filter(order => ["new", "pending", "pending payment"].includes(order.status.toLowerCase())).length;
  const content = section === "Products" ? <Products products={products} update={setProducts} saving={saving} onSaved={() => void saveProducts(products)} onProductCreated={refreshProducts} /> : section === "Orders" ? <Orders orders={visibleOrders} live={hasLiveOrders} savingOrder={savingOrder} onUpdate={updateOrder} /> : section === "Overview" ? <>
    <div className="welcome-row"><div><p className="overline">{todayLabel}</p><h1>Good morning</h1><p className="muted">A clear view of your little shop.</p></div><span className="preview-pill"><i /> Local preview</span></div>
    <section className="metrics" aria-label="Store performance"><Metric label="Revenue today" value={metrics ? formatMoney(metrics.todayRevenue) : metricsLoading ? "Loading…" : "Unavailable"} detail={metrics ? `${formatMoney(metrics.monthRevenue)} this month` : "Monthly paid orders"} icon="₹" /><Metric label="Total orders" value={metrics ? String(metrics.totalOrders) : metricsLoading ? "Loading…" : "Unavailable"} detail={metrics ? `${metrics.paidOrders} paid orders` : "All payment states"} icon="▤" /><Metric label="Average order value" value={metrics ? formatMoney(metrics.averageOrderValue, true) : metricsLoading ? "Loading…" : "Unavailable"} detail="Based on captured payments" icon="↗" /><Metric label="Low-stock products" value={metrics ? String(metrics.lowStockProducts) : metricsLoading ? "Loading…" : "Unavailable"} detail={metrics ? `Out of stock: ${metrics.outOfStockProducts} · low at 1–${metrics.lowStockThreshold} units` : "Threshold is configurable"} icon="◇" /></section>
    <OperationsInbox metrics={metrics} loading={metricsLoading} error={metricsError} onRetry={() => { setMetricsLoading(true); void loadAdminMetrics().then(result => { setMetrics(result); setMetricsError(""); }).catch(error => setMetricsError(error instanceof Error ? error.message : "Dashboard metrics are temporarily unavailable.")).finally(() => setMetricsLoading(false)); }} onOpen={setSection} />
    <section className="panel order-panel"><div className="panel-head"><div><p className="overline">LATEST ACTIVITY</p><h2>Order requests</h2></div><button className="text-button" onClick={() => setSection("Orders")}>View all <span>→</span></button></div><OrderTable orders={hasLiveOrders ? orders.slice(0, 2) : demoOrders.slice(0, 2)} /></section>
    <section className="panel stock-panel"><div className="panel-head"><div><p className="overline">INVENTORY</p><h2>Stock at a glance</h2></div><button className="text-button" onClick={() => setSection("Products")}>Manage stock <span>→</span></button></div><ProductRows products={products.slice(0, 3)} /></section>
  </> : <div className="page-heading"><div><p className="overline">WORKSPACE</p><h1>{section}</h1><p className="muted">This workspace is planned and will be added in a later dashboard feature.</p></div><StatusChip tone="neutral">Planned</StatusChip></div>;

  const filteredSections = sections.filter(item => item.toLowerCase().includes(commandQuery.toLowerCase()));
  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="#"><span className="brand-mark">k.</span><span>kalacar<small>OWNER SPACE</small></span></a><p className="nav-label">WORKSPACE</p><nav>{sections.map((item, i) => <button key={item} className={section === item ? "nav-item selected" : "nav-item"} onClick={() => { setSection(item); setMessage(""); }}><span className="nav-icon">{["⌂", "▤", "◇", "♙", "%", "⚙"][i]}</span>{item}{item === "Orders" && pendingCount > 0 && <b className="nav-count">{pendingCount}</b>}</button>)}</nav><div className="sidebar-bottom"><div className="owner-avatar">S</div><div className="owner-copy"><b>Shop owner</b><small>Local preview</small></div><button className="signout" title="Sign out" aria-label="Sign out" onClick={() => setSignedIn(false)}>↪</button></div></aside>
    <main className="main-content"><div className="mobile-brand"><span className="brand-mark">k.</span><span>kalacar <small>OWNER SPACE</small></span><button className="signout" onClick={() => setSignedIn(false)}>↪</button></div><div className="content-wrap"><header className="admin-bar"><button className="command-trigger" onClick={() => { setCommandOpen(true); setCommandQuery(""); }}><span>⌕</span> Search dashboard <kbd>⌘K</kbd></button><div className="admin-bar-actions"><span className="visibility-pill" title="A functional store visibility setting is planned for Store Settings"><i /> Visibility <strong>Planned</strong></span><button className="profile-trigger" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}><span className="owner-avatar">S</span><span>Shop owner</span><b>⌄</b></button>{profileOpen && <div className="profile-menu"><strong>Shop owner</strong><small>Local development preview</small><button onClick={() => { setProfileOpen(false); setSignedIn(false); }}>Sign out</button></div>}</div></header><nav className="mobile-section-nav" aria-label="Dashboard sections">{sections.map((item, i) => <button key={item} className={section === item ? "selected" : ""} aria-current={section === item ? "page" : undefined} onClick={() => setSection(item)}><span>{["⌂", "▤", "◇", "♙", "%", "⚙"][i]}</span>{item}{item === "Orders" && pendingCount > 0 && <b>{pendingCount}</b>}</button>)}</nav>{bannerVisible && <aside className="announcement"><span><b>Setup in progress</b><span> Dashboard tools are being added in stages. Store visibility settings are planned.</span></span><button aria-label="Dismiss setup notice" onClick={() => { window.sessionStorage.setItem("kalacar-dashboard-banner-dismissed", "yes"); setBannerVisible(false); }}>×</button></aside>}{apiError && <div className="warning" role="status">{apiError}</div>}{content}{message && <div className="toast" role="status">{message}</div>}<footer>Kalacar owner dashboard <span>·</span> local development preview</footer></div></main>
    <ModalDrawer open={commandOpen} title="Go to" onClose={() => setCommandOpen(false)}><FormField label="Search sections"><input autoFocus value={commandQuery} onChange={event => setCommandQuery(event.target.value)} placeholder="Type a section name…" /></FormField><div className="command-results">{filteredSections.map(item => <button key={item} onClick={() => { setSection(item); setCommandOpen(false); }}>{item}<span>↵</span></button>)}{filteredSections.length === 0 && <p>No matching sections.</p>}</div></ModalDrawer>
  </div>;
}

function formatMoney(amount: number, showPaise = false) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: showPaise ? 2 : 0, minimumFractionDigits: 0 }).format(amount);
}
function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) { return <article className="metric-card"><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>; }
function OperationsInbox({ metrics, loading, error, onRetry, onOpen }: { metrics: AdminMetrics | null; loading: boolean; error: string; onRetry: () => void; onOpen: (section: Section) => void }) {
  const alerts = metrics ? [
    { title: "Paid orders awaiting fulfillment", detail: "Prepare and update these orders for customers.", count: metrics.fulfillmentNeeded, section: "Orders" as const },
    { title: "Inventory needs attention", detail: `${metrics.outOfStockProducts} out of stock · ${metrics.lowStockProducts} low at 1–${metrics.lowStockThreshold} units.`, count: metrics.outOfStockProducts + metrics.lowStockProducts, section: "Products" as const },
    { title: "Payment recovery", detail: "Failed or interrupted payments may need follow-up.", count: metrics.paymentRecovery, section: "Orders" as const },
  ].filter(alert => alert.count > 0) : [];
  return <section className="panel operations-inbox" aria-live="polite"><div className="panel-head"><div><p className="overline">ACTION NEEDED</p><h2>Operations inbox</h2></div>{error && metrics && <span className="inbox-stale">Refresh unavailable · showing last data</span>}</div>
    {loading && !metrics ? <p className="inbox-message">Loading current orders and inventory…</p> : error && !metrics ? <div className="inbox-error"><p>{error}</p><button className="secondary" onClick={onRetry}>Try again</button></div> : alerts.length ? <div className="inbox-alerts">{alerts.map(alert => <article className="inbox-alert" key={alert.title}><span className="inbox-alert-mark" aria-hidden="true">!</span><div className="inbox-alert-copy"><b>{alert.title}</b><small>{alert.detail}</small></div><StatusChip tone="warning">{alert.count}</StatusChip><button className="text-button" onClick={() => onOpen(alert.section)}>{alert.section === "Orders" ? "Review orders" : "Manage stock"} <span>→</span></button></article>)}</div> : <p className="inbox-message inbox-clear"><span aria-hidden="true">✓</span> All caught up. No order, stock, or payment recovery alerts.</p>}
  </section>;
}
function Products({ products, update, onSaved, saving, onProductCreated }: { products: Product[]; update: (p: Product[]) => void; onSaved: () => void; saving: boolean; onProductCreated: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [name, setName] = useState("");
  const [deity, setDeity] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [images, setImages] = useState<File[]>([]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true); setCreateError("");
    try {
      const form = new FormData();
      form.set("name", name); form.set("deity", deity); form.set("price", price); form.set("stock", stock);
      images.forEach(file => form.append("images", file));
      const response = await fetch("/api/admin/products", { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Product could not be added.");
      await onProductCreated();
      setName(""); setDeity(""); setPrice(""); setStock("0"); setImages([]); setShowAdd(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Product could not be added.");
    } finally { setCreating(false); }
  }

  return <>
    <div className="page-heading"><div><p className="overline">YOUR CATALOGUE</p><h1>Products</h1><p className="muted">Manage murti prices, stock, and product photos.</p></div><div className="heading-actions"><button className="secondary" onClick={() => setShowAdd(!showAdd)}>{showAdd ? "Close" : "+ Add product"}</button><button className="primary" disabled={saving} onClick={onSaved}>{saving ? "Saving…" : "Save changes"}</button></div></div>
    {showAdd && <form className="panel add-product-form" onSubmit={create}>
      <div className="panel-head"><div><p className="overline">NEW CATALOGUE ITEM</p><h2>Add a product</h2></div></div>
      <div className="form-grid"><label>Product name<input required minLength={2} maxLength={160} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bal Krishna Murti" /></label><label>Deity<input required minLength={2} maxLength={80} value={deity} onChange={e => setDeity(e.target.value)} placeholder="e.g. Sri Krishna" /></label><label>Price (₹)<input required type="number" min="1" max="1000000" step="1" value={price} onChange={e => setPrice(e.target.value)} /></label><label>Stock quantity<input required type="number" min="0" max="1000000" step="1" value={stock} onChange={e => setStock(e.target.value)} /></label></div>
      <label className="upload-field">Product images <span>Choose 1–5 images, up to 5 MB each (JPG, PNG, WebP, AVIF)</span><input required type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={e => setImages(Array.from(e.target.files ?? []))} /></label>
      {images.length > 0 && <p className="file-summary">{images.length} image{images.length === 1 ? "" : "s"} selected: {images.map(file => file.name).join(", ")}</p>}
      {createError && <p className="form-error" role="alert">{createError}</p>}
      <div className="form-actions"><span>Preview price and stock; no discount is added automatically.</span><button className="primary" disabled={creating}>{creating ? "Adding…" : "Add product"}</button></div>
    </form>}
    <section className="panel"><ProductRows products={products} editable onChange={(id, key, value) => update(products.map(p => p.id === id ? { ...p, [key]: Number(value) } : p))} /></section>
  </>;
}
function ProductRows({ products, editable = false, onChange }: { products: Product[]; editable?: boolean; onChange?: (id: string, key: "price" | "stock", value: string) => void }) { return <div className="product-list">{products.map(p => <div className="product-row" key={p.id}><img src={p.image} alt="" /><div className="product-name"><b>{p.name}</b><small>{p.deity}</small></div><div className="product-field"><label>Price</label>{editable ? <span className="input-prefix">₹<input aria-label={`${p.name} price`} type="number" min="0" value={p.price} onChange={e => onChange?.(p.id, "price", e.target.value)} /></span> : <b>₹{p.price}</b>}</div><div className="product-field stock-field"><label>Available</label>{editable ? <input aria-label={`${p.name} stock`} type="number" min="0" value={p.stock} onChange={e => onChange?.(p.id, "stock", e.target.value)} /> : <span className={p.stock ? "stock-status" : "stock-status empty"}><i />{p.stock ? `${p.stock} units` : "Out of stock"}</span>}</div></div>)}</div>; }
function Orders({ orders, live, savingOrder, onUpdate }: { orders: Order[]; live: boolean; savingOrder: string; onUpdate: (id: string, status: string) => void }) { return <><div className="page-heading"><div><p className="overline">CUSTOMER REQUESTS</p><h1>Orders</h1><p className="muted">Review requests, then prepare and ship each murti.</p></div><span className="preview-pill"><i /> {live ? "Live order list" : "Demo data"}</span></div><section className="panel">{orders.length ? <DataTable columns={[{ key: "customer", label: "Customer", render: o => <div className="table-customer"><b>{o.customer}</b><small>{o.item}</small></div> }, { key: "order", label: "Order", render: o => <span>{o.id.length > 12 ? o.id.slice(0, 8) : o.id}</span> }, { key: "status", label: "Status", render: o => <StatusChip tone={o.status.toLowerCase() === "paid" ? "success" : "warning"}>{o.status}</StatusChip> }, { key: "total", label: "Total", render: o => <b>₹{o.total}</b> }, { key: "actions", label: "Fulfillment", render: o => { const fulfillment = o.fulfillmentStatus || "unfulfilled"; const next = ({ unfulfilled: ["processing", "Prepare"], processing: ["dispatched", "Dispatch"], dispatched: ["completed", "Complete"] } as Record<string, [string, string]>)[fulfillment]; return live && o.status === "Paid" && next ? <button className="fulfillment-button" type="button" disabled={savingOrder === o.id} onClick={() => onUpdate(o.id, next[0])}>{savingOrder === o.id ? "Saving…" : next[1]}</button> : <span className="table-muted">{fulfillment.replaceAll("_", " ")}</span>; } }]} rows={orders} rowKey={o => o.id} /> : <p className="empty-orders">No customer orders yet. Test-mode checkouts will appear here.</p>}</section>{!live && <p className="demo-note page-note">Example order requests are shown until the live order table is available.</p>}</>; }
function OrderTable({ orders }: { orders: Order[] }) { return <div className="orders-list">{orders.map(o => { const date = String(o.date); const dateLabel = date.includes("T") ? date.replace("T", " ").slice(0, 16) : date; return <article className="order-row" key={o.id}><div className="order-symbol">⌑</div><div className="order-main"><b>{o.customer}</b><small>{o.item}</small>{o.phone && <small>{o.phone} · {o.address}, {o.pincode}</small>}</div><div className="order-meta"><small>{o.id.length > 12 ? o.id.slice(0, 8) : o.id} · {dateLabel}</small><span className={`status ${o.status.toLowerCase().replaceAll(" ", "-")}`}>{o.status}</span></div><b className="order-total">₹{o.total}</b></article>; })}</div>; }
