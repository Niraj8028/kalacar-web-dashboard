import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { DataTable, FormField, ModalDrawer, StatusChip } from "./dashboard-ui";

type ProductAccordion = { id: string; title: string; content: string; format?: "rows" | "text"; active: boolean; defaultOpen: boolean };
type ProductAccordionRowDraft = { id: string; label: string; value: string };
type ProductAccordionDraft = ProductAccordion & { mode: "rows" | "text"; rows: ProductAccordionRowDraft[] };
type ProductImageDraft = { key: string; src?: string; file?: File; preview: string };
type Product = { id: string; name: string; deity: string; image: string; gallery?: string[]; placement?: string; accordions?: ProductAccordion[]; price: number; stock: number };
type Order = { id: string; date: string; customer: string; item: string; total: number; status: string; fulfillmentStatus?: string; email?: string; phone?: string; address?: string; pincode?: string };
type OrderDetail = Order & { items: { id: string; name: string; price: number; quantity: number }[] };
type AdminMetrics = { todayRevenue: number; monthRevenue: number; totalOrders: number; paidOrders: number; averageOrderValue: number; lowStockProducts: number; outOfStockProducts: number; lowStockThreshold: number; fulfillmentNeeded: number; paymentRecovery: number; paymentMode: "test" | "live" | "unconfigured" };
type OrderFilter = "all" | "pending_payment" | "processing" | "on_hold" | "dispatched" | "completed" | "cancelled" | "refunded";
type OrderStatusCounts = Record<OrderFilter, number>;
type Section = "Overview" | "Orders" | "Products" | "Customers" | "Coupons" | "Settings";
const sections: Section[] = ["Overview", "Orders", "Products", "Customers", "Coupons", "Settings"];
const orderFilters: { key: OrderFilter; label: string }[] = [
  { key: "all", label: "All" }, { key: "pending_payment", label: "Pending payment" },
  { key: "processing", label: "Processing" }, { key: "on_hold", label: "On hold" },
  { key: "dispatched", label: "Dispatched" }, { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" }, { key: "refunded", label: "Refunded" },
];

function parseAccordionRows(content: string): ProductAccordionRowDraft[] | null {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  const rows: ProductAccordionRowDraft[] = [];
  for (const line of lines) {
    const separator = line.indexOf(": ");
    if (separator < 1 || separator > 80) return null;
    const label = line.slice(0, separator).trim();
    const value = line.slice(separator + 2).trim();
    if (!label || !value) return null;
    rows.push({ id: crypto.randomUUID(), label, value });
  }
  return rows;
}

function toAccordionDraft(section: ProductAccordion): ProductAccordionDraft {
  const rows = parseAccordionRows(section.content);
  return { ...section, mode: section.format ?? (rows ? "rows" : "text"), rows: rows ?? [{ id: crypto.randomUUID(), label: "", value: "" }] };
}

async function loadAdminMetrics() {
  const response = await fetch("/api/admin/metrics", { cache: "no-store" });
  const data = await response.json() as AdminMetrics & { error?: string };
  if (!response.ok) throw new Error(data.error || "Dashboard metrics are temporarily unavailable.");
  return data;
}

export default function Dashboard() {
  const [owner, setOwner] = useState<{ name: string; email: string } | null>(null);
  const [authState, setAuthState] = useState<"checking" | "signedOut" | "notOwner" | "ready">("checking");
  const [authError, setAuthError] = useState("");
  const signedIn = authState === "ready";
  const [section, setSection] = useState<Section>("Overview");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(() => window.sessionStorage.getItem("kalacar-dashboard-banner-dismissed") !== "yes");
  const [products, setProducts] = useState<Product[]>([]);
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [orderCounts, setOrderCounts] = useState<OrderStatusCounts | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
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
      setProducts([]);
      setSavedProducts([]);
      setApiError("Shared inventory is unavailable. Product information is hidden until the connection returns.");
    }
  }

  useEffect(() => {
    void refreshProducts();
    if (section === "Products") return;
    const timer = window.setInterval(() => void refreshProducts(), 2500);
    return () => window.clearInterval(timer);
  }, [section]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const reason = url.searchParams.get("auth_error");
    if (reason) {
      setAuthError({ cancelled: "Google sign-in was cancelled.", expired: "Google sign-in expired. Please try again.", unverified: "That Google email isn’t verified." }[reason] ?? "Google sign-in failed. Please try again.");
      url.searchParams.delete("auth_error");
      window.history.replaceState(null, "", url);
    }
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async response => {
        const data = await response.json() as { user?: { name: string; email: string } | null; isOwner?: boolean; error?: string };
        if (!response.ok) throw new Error(data.error || "Account service is unavailable.");
        setOwner(data.user ?? null);
        setAuthState(!data.user ? "signedOut" : data.isOwner ? "ready" : "notOwner");
      })
      .catch(error => { setAuthError(error instanceof Error ? error.message : "Account service is unavailable."); setAuthState("signedOut"); });
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setOwner(null); setProfileOpen(false); setAuthState("signedOut");
  }

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    setOrdersLoading(true);
    setOrdersError("");
    const requestFilter = section === "Orders" ? orderFilter : "all";
    const refreshOrders = async () => {
      try {
        const response = await fetch(`/api/admin/orders?status=${requestFilter}`, { cache: "no-store" });
        const data = await response.json() as { orders?: Order[]; statusCounts?: OrderStatusCounts; error?: string };
        if (!response.ok) throw new Error(data.error || "Orders are temporarily unavailable.");
        if (active) { setOrders(data.orders ?? []); setOrderCounts(data.statusCounts ?? null); setOrdersError(""); }
      } catch (error) { if (active) { setOrders([]); setOrderCounts(null); setOrdersError(error instanceof Error ? error.message : "Orders are temporarily unavailable."); } }
      finally { if (active) setOrdersLoading(false); }
    };
    void refreshOrders();
    const timer = window.setInterval(refreshOrders, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [orderFilter, section, signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    const refreshMetrics = async () => {
      try {
        const result = await loadAdminMetrics();
        if (active) { setMetrics(result); setMetricsError(""); }
      } catch (error) {
        if (active) { setMetrics(null); setMetricsError(error instanceof Error ? error.message : "Dashboard metrics are temporarily unavailable."); }
      } finally {
        if (active) setMetricsLoading(false);
      }
    };
    void refreshMetrics();
    const timer = window.setInterval(refreshMetrics, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [signedIn]);

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
      const refreshed = await fetch(`/api/admin/orders?status=${orderFilter}`, { cache: "no-store" });
      if (!refreshed.ok) throw new Error("Status saved, but the order list could not refresh.");
      const result = await refreshed.json() as { orders: Order[]; statusCounts: OrderStatusCounts };
      setOrders(result.orders); setOrderCounts(result.statusCounts);
      try {
        const refreshedMetrics = await loadAdminMetrics();
        setMetrics(refreshedMetrics); setMetricsError("");
      } catch (error) {
        setMetrics(null); setMetricsError(error instanceof Error ? error.message : "Dashboard metrics are temporarily unavailable.");
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

  if (authState === "checking") return <main className="login-shell"><p className="muted">Checking your sign-in…</p></main>;
  if (!signedIn) return <main className="login-shell"><section className="login-card">
    <span className="brand-mark">k.</span><p className="overline">KALACAR · OWNER SPACE</p><h1>Welcome back</h1>
    <p className="muted">{authState === "notOwner" ? `${owner?.email ?? "This account"} isn’t on the owner list.` : "Sign in with the shop owner’s Google account."}</p>
    {authError && <p className="form-error" role="alert">{authError}</p>}
    {authState === "notOwner"
      ? <button className="primary wide" onClick={() => void signOut()}>Sign out and use another account</button>
      : <a className="google-button" href="/api/auth/google/start?next=/"><svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>Continue with Google</a>}
    <p className="demo-note">Only emails listed in KALACAR_OWNER_EMAILS can open the dashboard.</p>
  </section></main>;

  const todayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase();
  const pendingCount = orderCounts?.pending_payment ?? 0;
  const content = section === "Products" ? <Products products={products} update={setProducts} saving={saving} onSaved={() => void saveProducts(products)} onProductCreated={refreshProducts} apiError={apiError} /> : section === "Orders" ? <Orders orders={orders} loading={ordersLoading} error={ordersError} filter={orderFilter} counts={orderCounts} onFilter={setOrderFilter} paymentMode={metrics?.paymentMode ?? "unconfigured"} savingOrder={savingOrder} onUpdate={updateOrder} /> : section === "Overview" ? <>
    <div className="welcome-row"><div><p className="overline">{todayLabel}</p><h1>Good morning</h1><p className="muted">A clear view of your little shop.</p></div><span className="preview-pill"><i /> Local preview</span></div>
    {metrics?.paymentMode === "test" && <p className="test-mode-warning" role="note">Razorpay test mode · Orders and revenue shown here are test activity, not live sales.</p>}
    {metrics?.paymentMode === "unconfigured" && <p className="test-mode-warning" role="note">Payment mode is not configured · Do not treat these order totals as live sales.</p>}
    <section className="metrics" aria-label="Store performance"><Metric label="Revenue today" value={metrics ? formatMoney(metrics.todayRevenue) : metricsLoading ? "Loading…" : "Unavailable"} detail={metrics ? `${formatMoney(metrics.monthRevenue)} this month` : "Monthly paid orders"} icon="₹" /><Metric label="Total orders" value={metrics ? String(metrics.totalOrders) : metricsLoading ? "Loading…" : "Unavailable"} detail={metrics ? `${metrics.paidOrders} paid orders` : "All payment states"} icon="▤" /><Metric label="Average order value" value={metrics ? formatMoney(metrics.averageOrderValue, true) : metricsLoading ? "Loading…" : "Unavailable"} detail="Based on captured payments" icon="↗" /><Metric label="Low-stock products" value={metrics ? String(metrics.lowStockProducts) : metricsLoading ? "Loading…" : "Unavailable"} detail={metrics ? `Out of stock: ${metrics.outOfStockProducts} · low at 1–${metrics.lowStockThreshold} units` : "Threshold is configurable"} icon="◇" /></section>
    <OperationsInbox metrics={metrics} loading={metricsLoading} error={metricsError} onRetry={() => { setMetricsLoading(true); void loadAdminMetrics().then(result => { setMetrics(result); setMetricsError(""); }).catch(error => { setMetrics(null); setMetricsError(error instanceof Error ? error.message : "Dashboard metrics are temporarily unavailable."); }).finally(() => setMetricsLoading(false)); }} onOpen={setSection} />
    <section className="panel order-panel"><div className="panel-head"><div><p className="overline">LATEST ACTIVITY</p><h2>Order requests</h2></div><button className="text-button" onClick={() => setSection("Orders")}>View all <span>→</span></button></div>{ordersLoading ? <p className="empty-orders">Loading orders…</p> : ordersError ? <p className="empty-orders" role="alert">{ordersError}</p> : orders.length ? <OrderTable orders={orders.slice(0, 2)} /> : <p className="empty-orders">No orders have been recorded.</p>}</section>
    <section className="panel stock-panel"><div className="panel-head"><div><p className="overline">INVENTORY</p><h2>Stock at a glance</h2></div><button className="text-button" onClick={() => setSection("Products")}>Manage stock <span>→</span></button></div>{products.length ? <ProductRows products={products.slice(0, 3)} /> : <p className="empty-orders">{apiError || "No products have been added."}</p>}</section>
  </> : <div className="page-heading"><div><p className="overline">WORKSPACE</p><h1>{section}</h1><p className="muted">This workspace is planned and will be added in a later dashboard feature.</p></div><StatusChip tone="neutral">Planned</StatusChip></div>;

  const filteredSections = sections.filter(item => item.toLowerCase().includes(commandQuery.toLowerCase()));
  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="#"><span className="brand-mark">k.</span><span>kalacar<small>OWNER SPACE</small></span></a><p className="nav-label">WORKSPACE</p><nav>{sections.map((item, i) => <button key={item} className={section === item ? "nav-item selected" : "nav-item"} onClick={() => { setSection(item); setMessage(""); }}><span className="nav-icon">{["⌂", "▤", "◇", "♙", "%", "⚙"][i]}</span>{item}{item === "Orders" && pendingCount > 0 && <b className="nav-count">{pendingCount}</b>}</button>)}</nav><div className="sidebar-bottom"><div className="owner-avatar">S</div><div className="owner-copy"><b>Shop owner</b><small>Local preview</small></div><button className="signout" title="Sign out" aria-label="Sign out" onClick={() => void signOut()}>↪</button></div></aside>
    <main className="main-content"><div className="mobile-brand"><span className="brand-mark">k.</span><span>kalacar <small>OWNER SPACE</small></span><button className="signout" onClick={() => void signOut()}>↪</button></div><div className="content-wrap"><header className="admin-bar"><button className="command-trigger" onClick={() => { setCommandOpen(true); setCommandQuery(""); }}><span>⌕</span> Search dashboard <kbd>⌘K</kbd></button><div className="admin-bar-actions"><span className="visibility-pill" title="A functional store visibility setting is planned for Store Settings"><i /> Visibility <strong>Planned</strong></span><button className="profile-trigger" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}><span className="owner-avatar">{(owner?.name ?? "S").charAt(0).toUpperCase()}</span><span>{owner?.name ?? "Shop owner"}</span><b>⌄</b></button>{profileOpen && <div className="profile-menu"><strong>{owner?.name ?? "Shop owner"}</strong><small>{owner?.email}</small><button onClick={() => void signOut()}>Sign out</button></div>}</div></header><nav className="mobile-section-nav" aria-label="Dashboard sections">{sections.map((item, i) => <button key={item} className={section === item ? "selected" : ""} aria-current={section === item ? "page" : undefined} onClick={() => setSection(item)}><span>{["⌂", "▤", "◇", "♙", "%", "⚙"][i]}</span>{item}{item === "Orders" && pendingCount > 0 && <b>{pendingCount}</b>}</button>)}</nav>{bannerVisible && <aside className="announcement"><span><b>Setup in progress</b><span> Dashboard tools are being added in stages. Store visibility settings are planned.</span></span><button aria-label="Dismiss setup notice" onClick={() => { window.sessionStorage.setItem("kalacar-dashboard-banner-dismissed", "yes"); setBannerVisible(false); }}>×</button></aside>}{apiError && <div className="warning" role="status">{apiError}</div>}{content}{message && <div className="toast" role="status">{message}</div>}<footer>Kalacar owner dashboard <span>·</span> local development preview</footer></div></main>
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
  return <section className="panel operations-inbox" aria-live="polite"><div className="panel-head"><div><p className="overline">ACTION NEEDED</p><h2>Operations inbox</h2></div></div>
    {loading && !metrics ? <p className="inbox-message">Loading current orders and inventory…</p> : error && !metrics ? <div className="inbox-error"><p>{error}</p><button className="secondary" onClick={onRetry}>Try again</button></div> : alerts.length ? <div className="inbox-alerts">{alerts.map(alert => <article className="inbox-alert" key={alert.title}><span className="inbox-alert-mark" aria-hidden="true">!</span><div className="inbox-alert-copy"><b>{alert.title}</b><small>{alert.detail}</small></div><StatusChip tone="warning">{alert.count}</StatusChip><button className="text-button" onClick={() => onOpen(alert.section)}>{alert.section === "Orders" ? "Review orders" : "Manage stock"} <span>→</span></button></article>)}</div> : <p className="inbox-message inbox-clear"><span aria-hidden="true">✓</span> All caught up. No order, stock, or payment recovery alerts.</p>}
  </section>;
}
function Products({ products, update, onSaved, saving, onProductCreated, apiError }: { products: Product[]; update: (p: Product[]) => void; onSaved: () => void; saving: boolean; onProductCreated: () => void; apiError: string }) {
  const [editorProduct, setEditorProduct] = useState<Product | null | undefined>(undefined);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  return <>
    <div className="page-heading"><div><p className="overline">YOUR CATALOGUE</p><h1>Products</h1><p className="muted">Manage product details, photos, prices, and stock.</p></div><div className="heading-actions"><button className="secondary" onClick={() => setEditorProduct(null)}>+ Add product</button><button className="primary" disabled={saving} onClick={onSaved}>{saving ? "Saving…" : "Save changes"}</button></div></div>
    {editorProduct !== undefined && <ProductEditor key={editorProduct?.id ?? "new"} product={editorProduct} onCancel={() => setEditorProduct(undefined)} onSaved={async () => { await onProductCreated(); setEditorProduct(undefined); }} />}
    <section className="panel">{apiError ? <p className="empty-orders" role="alert">{apiError}</p> : products.length ? <ProductRows products={products} editable onEdit={setEditorProduct} onPreview={setPreviewProduct} onChange={(id, key, value) => update(products.map(p => p.id === id ? { ...p, [key]: Number(value) } : p))} /> : <p className="empty-orders">No products have been added yet.</p>}</section>
    <ModalDrawer open={Boolean(previewProduct)} title="Product preview" onClose={() => setPreviewProduct(null)} wide>{previewProduct && <ProductPreview key={previewProduct.id} product={previewProduct} />}</ModalDrawer>
  </>;
}

function ProductEditor({ product, onCancel, onSaved }: { product: Product | null; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(product?.name ?? "");
  const [deity, setDeity] = useState(product?.deity ?? "");
  const [placement, setPlacement] = useState(product?.placement ?? "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [images, setImages] = useState<ProductImageDraft[]>(() => (product?.gallery?.length ? product.gallery : product?.image ? [product.image] : []).map((src, index) => ({ key: `${product?.id ?? "new"}-${index}-${src}`, src, preview: src })));
  const previewUrls = useRef(new Set<string>());
  const [accordions, setAccordions] = useState<ProductAccordionDraft[]>(() => (product?.accordions ?? []).map(toAccordionDraft));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const existingImages = product?.gallery?.length ? product.gallery : product?.image ? [product.image] : [];

  useEffect(() => () => { previewUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);

  function addImages(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (images.length + selected.length > 5) { setError("A product can have up to 5 images."); return; }
    const added = selected.map(file => {
      const preview = URL.createObjectURL(file);
      previewUrls.current.add(preview);
      return { key: crypto.randomUUID(), file, preview };
    });
    setImages(current => [...current, ...added]); setError("");
  }

  function replaceImage(key: string, file?: File) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    previewUrls.current.add(preview);
    const previous = images.find(image => image.key === key);
    if (previous?.file && previewUrls.current.delete(previous.preview)) URL.revokeObjectURL(previous.preview);
    setImages(current => current.map(image => image.key === key ? { ...image, src: undefined, file, preview } : image));
    setError("");
  }

  function removeImage(key: string) {
    const image = images.find(item => item.key === key);
    if (image?.file && previewUrls.current.delete(image.preview)) URL.revokeObjectURL(image.preview);
    setImages(current => current.filter(item => item.key !== key));
  }

  function addSection(title = "") {
    setAccordions(current => [...current, { id: crypto.randomUUID(), title, content: "", mode: "rows", rows: [{ id: crypto.randomUUID(), label: "", value: "" }], active: true, defaultOpen: false }]);
  }
  function addCommonSections() {
    setAccordions(current => [...current, ...["Dimensions & weight", "Material & finish", "Care instructions", "Packaging & delivery"].slice(0, 12 - current.length).map(title => ({ id: crypto.randomUUID(), title, content: "", mode: "rows" as const, rows: [{ id: crypto.randomUUID(), label: "", value: "" }], active: true, defaultOpen: false }))]);
  }
  function setSection(id: string, patch: Partial<ProductAccordionDraft>) {
    setAccordions(current => current.map(section => section.id === id ? { ...section, ...patch, ...(patch.active === false ? { defaultOpen: false } : {}) } : section));
  }
  function setSectionMode(section: ProductAccordionDraft, mode: "rows" | "text") {
    if (mode === "rows") {
      const parsed = parseAccordionRows(section.content);
      const rows = parsed ?? (section.content.trim() ? [{ id: crypto.randomUUID(), label: "Details", value: section.content.trim() }] : section.rows.length ? section.rows : [{ id: crypto.randomUUID(), label: "", value: "" }]);
      setSection(section.id, { mode, format: mode, rows });
    } else {
      const content = section.rows.filter(row => row.label.trim() && row.value.trim()).map(row => `${row.label.trim()} — ${row.value.trim()}`).join("\n");
      setSection(section.id, { mode, format: mode, content });
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      if (images.length < 1 || images.length > 5) throw new Error("Keep between 1 and 5 product images.");
      const form = new FormData();
      form.set("name", name); form.set("deity", deity); form.set("placement", placement); form.set("price", price); form.set("stock", stock);
      const savedAccordions: ProductAccordion[] = accordions.map(({ mode, rows, ...section }) => ({ ...section, format: mode, content: mode === "rows" ? rows.filter(row => row.label.trim() && row.value.trim()).map(row => `${row.label.trim()}: ${row.value.trim()}`).join("\n") : section.content }));
      form.set("accordions", JSON.stringify(savedAccordions));
      if (product) {
        let uploadIndex = 0;
        const uploadFiles: File[] = [];
        const manifest = images.map(image => {
          if (image.file) { uploadFiles.push(image.file); return { kind: "upload", uploadIndex: uploadIndex++ }; }
          return { kind: "existing", src: image.src };
        });
        form.set("galleryManifest", JSON.stringify(manifest));
        uploadFiles.forEach(file => form.append("images", file));
      } else {
        images.forEach(image => { if (image.file) form.append("images", image.file); });
      }
      const url = product ? `/api/admin/products/${encodeURIComponent(product.id)}` : "/api/admin/products";
      const response = await fetch(url, { method: product ? "PATCH" : "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Product could not be saved.");
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Product could not be saved."); }
    finally { setSaving(false); }
  }

  return <form className="panel add-product-form" onSubmit={submit}>
    <div className="panel-head"><div><p className="overline">{product ? "EDIT CATALOGUE ITEM" : "NEW CATALOGUE ITEM"}</p><h2>{product ? `Edit ${product.name}` : "Add a product"}</h2></div><button className="secondary" type="button" onClick={onCancel}>Close</button></div>
    <div className="form-grid"><label>Product name<input required minLength={2} maxLength={160} value={name} onChange={e => setName(e.target.value)} /></label><label>Deity<input required minLength={2} maxLength={80} value={deity} onChange={e => setDeity(e.target.value)} /></label><label>Short description / placement (optional)<textarea maxLength={255} value={placement} onChange={e => setPlacement(e.target.value)} /></label><label>Price (₹)<input required type="number" min="1" max="1000000" step="1" value={price} onChange={e => setPrice(e.target.value)} /></label><label>Stock quantity<input required type="number" min="0" max="1000000" step="1" value={stock} onChange={e => setStock(e.target.value)} /></label></div>
    {existingImages.length > 0 && <p className="file-summary">Replace an individual image, remove it, or use the arrows to change gallery order. The first image is the main product image.</p>}
    <div className="product-image-editor" aria-label="Product image gallery">
      {images.map((image, index) => <div className="product-image-editor-item" key={image.key}><img src={image.preview} alt={`Product image ${index + 1}`} /><div className="product-image-editor-actions"><strong>{index === 0 ? "Main image" : `Image ${index + 1}`}</strong><label className="secondary image-replace-control">Replace<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => replaceImage(image.key, e.target.files?.[0])} /></label><button className="secondary" type="button" aria-label={`Move image ${index + 1} up`} disabled={index === 0} onClick={() => setImages(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>↑</button><button className="secondary" type="button" aria-label={`Move image ${index + 1} down`} disabled={index === images.length - 1} onClick={() => setImages(current => { const next = [...current]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}>↓</button><button className="secondary" type="button" aria-label={`Remove image ${index + 1}`} onClick={() => removeImage(image.key)}>Remove</button></div></div>)}
    </div>
    <label className="upload-field">Add images <span>Choose additional JPG, PNG, WebP, or AVIF photos, up to 5 MB each; maximum 5 images per product.</span><input disabled={images.length >= 5} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={e => { addImages(e.target.files); e.currentTarget.value = ""; }} /></label>
    <div className="accordion-editor"><div className="accordion-editor-heading"><div><p className="overline">PRODUCT DETAILS</p><h3>Detail accordions</h3><p>Add multiple titled sections; each can contain multiple key/value pairs. Only use facts confirmed for this product. Inactive sections stay hidden on the storefront.</p></div><button className="secondary" type="button" disabled={accordions.length > 8} onClick={addCommonSections}>Add common sections</button></div>
      {accordions.map((section, index) => <div className="accordion-editor-row" key={section.id}><div className="accordion-editor-controls"><label>Accordion title<input required={section.active} maxLength={80} value={section.title} onChange={e => setSection(section.id, { title: e.target.value })} /></label><label>Content format<select value={section.mode} onChange={e => setSectionMode(section, e.target.value as "rows" | "text")}><option value="rows">Key/value details</option><option value="text">Paragraph text</option></select></label>{section.mode === "rows" ? <div className="accordion-content-rows"><div className="accordion-content-rows-heading"><strong>Information rows</strong><span>Shown as a two-column table</span></div>{section.rows.map((row, rowIndex) => <div className="accordion-content-row" key={row.id}><label>Label<input required={section.active} maxLength={80} placeholder="e.g. Brand name" value={row.label} onChange={e => setSection(section.id, { rows: section.rows.map(item => item.id === row.id ? { ...item, label: e.target.value } : item) })} /></label><label>Value<input required={section.active} maxLength={500} placeholder="Enter owner-confirmed value" value={row.value} onChange={e => setSection(section.id, { rows: section.rows.map(item => item.id === row.id ? { ...item, value: e.target.value } : item) })} /></label><button className="secondary" type="button" aria-label={`Remove information row ${rowIndex + 1}`} disabled={section.rows.length === 1} onClick={() => setSection(section.id, { rows: section.rows.filter(item => item.id !== row.id) })}>Remove row</button></div>)}<button className="secondary" type="button" disabled={section.rows.length >= 20} onClick={() => setSection(section.id, { rows: [...section.rows, { id: crypto.randomUUID(), label: "", value: "" }] })}>+ Add information row</button></div> : <label>Paragraph content<textarea required={section.active} maxLength={3000} value={section.content} onChange={e => setSection(section.id, { content: e.target.value })} /></label>}<label className="check-label"><input type="checkbox" checked={section.active} onChange={e => setSection(section.id, { active: e.target.checked })} /> Show on storefront</label><label className="check-label"><input type="checkbox" checked={section.defaultOpen} onChange={e => setSection(section.id, { defaultOpen: e.target.checked })} /> Open by default</label></div><div className="accordion-row-actions"><button className="secondary" type="button" aria-label="Move section up" disabled={index === 0} onClick={() => setAccordions(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>↑</button><button className="secondary" type="button" aria-label="Move section down" disabled={index === accordions.length - 1} onClick={() => setAccordions(current => { const next = [...current]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}>↓</button><button className="secondary" type="button" onClick={() => setAccordions(current => current.filter(item => item.id !== section.id))}>Delete section</button></div></div>)}
      <button className="secondary" type="button" disabled={accordions.length >= 12} onClick={() => addSection()}>+ Add detail accordion</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><span>Use owner-confirmed details and prices. No discounts are added automatically.</span><button className="primary" disabled={saving}>{saving ? "Saving…" : product ? "Save product" : "Add product"}</button></div>
  </form>;
}

function ProductRows({ products, editable = false, onChange, onEdit, onPreview }: { products: Product[]; editable?: boolean; onChange?: (id: string, key: "price" | "stock", value: string) => void; onEdit?: (product: Product) => void; onPreview?: (product: Product) => void }) { return <div className="product-list">{products.map(p => <div className={editable ? "product-row product-row-editable" : "product-row"} key={p.id}><img src={p.image} alt="" /><div className="product-name"><b>{p.name}</b><small>{p.deity}</small></div><div className="product-field"><label>Price</label>{editable ? <span className="input-prefix">₹<input aria-label={`${p.name} price`} type="number" min="0" value={p.price} onChange={e => onChange?.(p.id, "price", e.target.value)} /></span> : <b>₹{p.price}</b>}</div><div className="product-field stock-field"><label>Available</label>{editable ? <input aria-label={`${p.name} stock`} type="number" min="0" value={p.stock} onChange={e => onChange?.(p.id, "stock", e.target.value)} /> : <span className={p.stock ? "stock-status" : "stock-status empty"}><i />{p.stock ? `${p.stock} units` : "Out of stock"}</span>}</div>{editable && onPreview && <button className="secondary preview-product-button" type="button" onClick={() => onPreview(p)}>Preview</button>}{editable && onEdit && <button className="secondary edit-product-button" type="button" onClick={() => onEdit(p)}>Edit details</button>}</div>)}</div>; }

function ProductPreview({ product }: { product: Product }) {
  const gallery = product.gallery?.length ? product.gallery : [product.image];
  const [activeImage, setActiveImage] = useState(gallery[0]);
  const details = (product.accordions ?? []).filter(section => section.active && section.title.trim() && section.content.trim());
  return <div className="product-preview">
    <div className="product-preview-toolbar"><div><p className="overline">SAVED CATALOGUE VERSION</p><span>Read-only preview · Customer-facing product information</span></div><StatusChip tone={product.stock > 0 ? "success" : "neutral"}>{product.stock > 0 ? "In stock" : "Out of stock"}</StatusChip></div>
    <div className="product-preview-layout">
      <section className="product-preview-gallery" aria-label="Product image preview"><div className="product-preview-main-image"><img src={activeImage} alt={`${product.name} product view`} /></div>{gallery.length > 1 && <div className="product-preview-thumbnails" aria-label="Choose product image">{gallery.map((image, index) => <button className={activeImage === image ? "selected" : ""} type="button" key={`${image}-${index}`} aria-label={`View image ${index + 1}`} aria-pressed={activeImage === image} onClick={() => setActiveImage(image)}><img src={image} alt="" /></button>)}</div>}</section>
      <section className="product-preview-info"><div className="product-preview-heading"><div><span className="product-preview-deity">{product.deity}</span><h3>{product.name}</h3></div><StatusChip tone="neutral">Saved</StatusChip></div>{product.placement && <p className="product-preview-description">{product.placement}</p>}<div className="product-preview-price">₹{product.price}<span>Current catalogue price</span></div><div className="product-preview-facts"><div><span>Availability</span><b>{product.stock > 0 ? `${product.stock} units` : "Out of stock"}</b></div><div><span>Gallery</span><b>{gallery.length} image{gallery.length === 1 ? "" : "s"}</b></div></div>
        <div className="product-preview-details"><div className="product-preview-details-heading"><h4>Product details</h4><span>{details.length} active section{details.length === 1 ? "" : "s"}</span></div>{details.length ? details.map(section => <details key={section.id} open={section.defaultOpen}><summary>{section.title}<span aria-hidden="true">{section.defaultOpen ? "−" : "+"}</span></summary><ProductPreviewAccordionContent content={section.content} format={section.format} /></details>) : <p className="product-preview-empty">No additional product details have been saved.</p>}</div>
      </section>
    </div>
    <p className="product-preview-footnote">This preview shows saved dashboard data. Unsaved edits are not included.</p>
  </div>;
}

function ProductPreviewAccordionContent({ content, format }: { content: string; format?: "rows" | "text" }) {
  const rows = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const separator = line.indexOf(": ");
    if (separator < 1 || separator > 80) return null;
    const label = line.slice(0, separator).trim();
    const value = line.slice(separator + 2).trim();
    return label && value ? { label, value } : null;
  });
  const isTable = format !== "text" && rows.length > 0 && rows.every((row): row is { label: string; value: string } => row !== null);
  return isTable ? <dl className="product-preview-specs">{rows.map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl> : <p>{content}</p>;
}
function Orders({ orders, loading, error, filter, counts, onFilter, paymentMode, savingOrder, onUpdate }: { orders: Order[]; loading: boolean; error: string; filter: OrderFilter; counts: OrderStatusCounts | null; onFilter: (filter: OrderFilter) => void; paymentMode: AdminMetrics["paymentMode"]; savingOrder: string; onUpdate: (id: string, status: string) => void }) {
  const [detailOrderId, setDetailOrderId] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [addressCopied, setAddressCopied] = useState(false);
  async function openDetails(id: string) {
    setDetailOrderId(id); setDetail(null); setDetailError(""); setAddressCopied(false); setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json() as { order?: OrderDetail; error?: string };
      if (!response.ok || !data.order) throw new Error(data.error || "Order details are temporarily unavailable.");
      setDetail(data.order);
    } catch (cause) { setDetailError(cause instanceof Error ? cause.message : "Order details are temporarily unavailable."); }
    finally { setDetailLoading(false); }
  }
  async function copyAddress() {
    if (!detail) return;
    const address = [detail.customer, detail.phone, detail.address, detail.pincode].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(address); setAddressCopied(true); window.setTimeout(() => setAddressCopied(false), 2000); }
    catch { setDetailError("Could not access the clipboard. Select and copy the address manually."); }
  }
  const total = counts?.[filter] ?? 0;
  return <><div className="page-heading"><div><p className="overline">CUSTOMER REQUESTS</p><h1>Orders</h1><p className="muted">Review orders and update fulfillment progress.</p></div><span className="preview-pill"><i /> Connected order records</span></div>
    {paymentMode === "test" && <p className="test-mode-warning" role="note">Razorpay test mode · These orders are test activity, not live sales.</p>}
    {paymentMode === "unconfigured" && <p className="test-mode-warning" role="note">Payment mode is not configured · Do not treat these orders as live sales.</p>}
    <section className="panel order-filters" role="group" aria-label="Filter orders by status">{orderFilters.map(item => <button type="button" key={item.key} className={filter === item.key ? "order-filter selected" : "order-filter"} aria-pressed={filter === item.key} onClick={() => onFilter(item.key)}>{item.label}<span>{counts?.[item.key] ?? "—"}</span></button>)}</section>
    <section className="panel">{error ? <p className="empty-orders" role="alert">{error}</p> : loading ? <p className="empty-orders">Loading orders…</p> : orders.length ? <><p className="muted order-limit-note">Showing {orders.length} most recent of {total} matching orders.</p><DataTable columns={[{ key: "customer", label: "Customer", render: o => <div className="table-customer"><b>{o.customer}</b><small>{o.item}</small></div> }, { key: "order", label: "Order", render: o => <span>{o.id.length > 12 ? o.id.slice(0, 8) : o.id}</span> }, { key: "status", label: "Status", render: o => <StatusChip tone={o.status.toLowerCase() === "paid" ? "success" : "warning"}>{o.status}</StatusChip> }, { key: "total", label: "Total", render: o => <b>₹{o.total}</b> }, { key: "actions", label: "Actions", render: o => { const fulfillment = o.fulfillmentStatus || "unfulfilled"; const next = ({ unfulfilled: ["processing", "Prepare"], processing: ["dispatched", "Dispatch"], dispatched: ["completed", "Complete"] } as Record<string, [string, string]>)[fulfillment]; return <div className="order-actions"><button className="text-button" type="button" onClick={() => void openDetails(o.id)}>View details</button>{o.status === "Paid" && next ? <button className="fulfillment-button" type="button" disabled={savingOrder === o.id} onClick={() => onUpdate(o.id, next[0])}>{savingOrder === o.id ? "Saving…" : next[1]}</button> : <span className="table-muted">{fulfillment.replaceAll("_", " ")}</span>}</div>; } }]} rows={orders} rowKey={o => o.id} /></> : <p className="empty-orders">{filter === "all" ? "No orders have been recorded." : `No ${orderFilters.find(item => item.key === filter)?.label.toLowerCase()} orders.`}</p>}</section>
    <ModalDrawer open={Boolean(detailOrderId)} title={detail ? `Order ${detail.id.slice(0, 8)}` : "Order details"} onClose={() => { setDetailOrderId(""); setDetail(null); setDetailError(""); }}><div className="order-detail-content">{detailLoading ? <p role="status">Loading saved order details…</p> : detailError && !detail ? <p role="alert" className="order-detail-error">{detailError}</p> : detail ? <>
      <div className="order-detail-summary"><div><span>Customer</span><b>{detail.customer}</b></div><div><span>Order status</span><StatusChip tone={detail.status.toLowerCase() === "paid" ? "success" : "warning"}>{detail.status}</StatusChip></div><div><span>Email</span><a href={`mailto:${detail.email}`}>{detail.email}</a></div><div><span>Phone</span><a href={`tel:${detail.phone}`}>{detail.phone}</a></div></div>
      <section className="order-detail-section"><h3>Items</h3>{detail.items.length ? <div className="order-detail-items">{detail.items.map((item, index) => <div className="order-detail-item" key={`${item.id}-${index}`}><span>{item.name}<small>{item.quantity} × ₹{item.price}</small></span><b>₹{item.quantity * item.price}</b></div>)}</div> : <p>No item rows were saved for this order.</p>}<div className="order-detail-total"><span>Order total</span><b>₹{detail.total}</b></div></section>
      <section className="order-detail-section"><div className="order-detail-heading"><h3>Delivery address</h3><button className="secondary" type="button" onClick={() => void copyAddress()}>{addressCopied ? "Copied" : "Copy address"}</button></div><address>{detail.customer}{detail.phone && <><br />{detail.phone}</>}{detail.address && <><br />{detail.address}</>}{detail.pincode && <><br />PIN {detail.pincode}</>}</address></section>
      <section className="order-detail-section"><h3>Customer note</h3><p>No customer note was provided with this order.</p></section>
      {detailError && <p role="alert" className="order-detail-error">{detailError}</p>}
    </> : null}</div></ModalDrawer>
  </>;
}
function OrderTable({ orders }: { orders: Order[] }) { return <div className="orders-list">{orders.map(o => { const date = String(o.date); const dateLabel = date.includes("T") ? date.replace("T", " ").slice(0, 16) : date; return <article className="order-row" key={o.id}><div className="order-symbol">⌑</div><div className="order-main"><b>{o.customer}</b><small>{o.item}</small>{o.phone && <small>{o.phone} · {o.address}, {o.pincode}</small>}</div><div className="order-meta"><small>{o.id.length > 12 ? o.id.slice(0, 8) : o.id} · {dateLabel}</small><span className={`status ${o.status.toLowerCase().replaceAll(" ", "-")}`}>{o.status}</span></div><b className="order-total">₹{o.total}</b></article>; })}</div>; }
