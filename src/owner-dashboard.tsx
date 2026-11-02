import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Product = { id: string; name: string; deity: string; image: string; price: number; stock: number };
type Order = { id: string; date: string; customer: string; item: string; total: number; status: string; email?: string; phone?: string; address?: string; pincode?: string };

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
  const [section, setSection] = useState<"Overview" | "Products" | "Orders">("Overview");
  const [products, setProducts] = useState(initialProducts);
  const [savedProducts, setSavedProducts] = useState(initialProducts);
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasLiveOrders, setHasLiveOrders] = useState(false);
  const [message, setMessage] = useState("");
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);

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

  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const content = section === "Products" ? <Products products={products} update={setProducts} saving={saving} onSaved={() => void saveProducts(products)} onProductCreated={refreshProducts} /> : section === "Orders" ? <Orders orders={hasLiveOrders ? orders : demoOrders} live={hasLiveOrders} /> : <>
    <div className="welcome-row"><div><p className="overline">MONDAY, 2 NOVEMBER</p><h1>Good morning</h1><p className="muted">A clear view of your little shop.</p></div><span className="preview-pill"><i /> Local preview</span></div>
    <section className="metrics"><Metric label="New requests" value="1" detail="Needs your attention" icon="↗" /><Metric label="Products listed" value={String(products.length)} detail="Across 3 collections" icon="◇" /><Metric label="Units in stock" value={String(totalStock)} detail="Across all murtis" icon="▤" /></section>
    <section className="panel order-panel"><div className="panel-head"><div><p className="overline">LATEST ACTIVITY</p><h2>Order requests</h2></div><button className="text-button" onClick={() => setSection("Orders")}>View all <span>→</span></button></div><OrderTable orders={hasLiveOrders ? orders.slice(0, 2) : demoOrders.slice(0, 2)} /></section>
    <section className="panel stock-panel"><div className="panel-head"><div><p className="overline">INVENTORY</p><h2>Stock at a glance</h2></div><button className="text-button" onClick={() => setSection("Products")}>Manage stock <span>→</span></button></div><ProductRows products={products.slice(0, 3)} /></section>
  </>;

  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="#"><span className="brand-mark">k.</span><span>kalacar<small>OWNER SPACE</small></span></a><p className="nav-label">WORKSPACE</p><nav>{(["Overview", "Products", "Orders"] as const).map((item, i) => <button key={item} className={section === item ? "nav-item selected" : "nav-item"} onClick={() => { setSection(item); setMessage(""); }}><span className="nav-icon">{["⌂", "◇", "▤"][i]}</span>{item}{item === "Orders" && <b className="nav-count">2</b>}</button>)}</nav><div className="sidebar-bottom"><div className="owner-avatar">S</div><div className="owner-copy"><b>Shop owner</b><small>Local preview</small></div><button className="signout" title="Sign out" onClick={() => setSignedIn(false)}>↪</button></div></aside>
    <main className="main-content"><div className="mobile-brand"><span className="brand-mark">k.</span><span>kalacar <small>OWNER SPACE</small></span><button className="signout" onClick={() => setSignedIn(false)}>↪</button></div><div className="content-wrap">{apiError && <div className="warning" role="status">{apiError}</div>}{content}{message && <div className="toast" role="status">{message}</div>}<footer>Kalacar owner dashboard <span>·</span> local development preview</footer></div></main>
  </div>;
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) { return <article className="metric-card"><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>; }
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
function Orders({ orders, live }: { orders: Order[]; live: boolean }) { return <><div className="page-heading"><div><p className="overline">CUSTOMER REQUESTS</p><h1>Orders</h1><p className="muted">Review requests, then prepare and ship each murti.</p></div><span className="preview-pill"><i /> {live ? "Live order list" : "Demo data"}</span></div><section className="panel">{orders.length ? <OrderTable orders={orders} /> : <p className="empty-orders">No customer orders yet. Test-mode checkouts will appear here.</p>}</section>{!live && <p className="demo-note page-note">Example order requests are shown until the live order table is available.</p>}</>; }
function OrderTable({ orders }: { orders: Order[] }) { return <div className="orders-list">{orders.map(o => { const date = String(o.date); const dateLabel = date.includes("T") ? date.replace("T", " ").slice(0, 16) : date; return <article className="order-row" key={o.id}><div className="order-symbol">⌑</div><div className="order-main"><b>{o.customer}</b><small>{o.item}</small>{o.phone && <small>{o.phone} · {o.address}, {o.pincode}</small>}</div><div className="order-meta"><small>{o.id.length > 12 ? o.id.slice(0, 8) : o.id} · {dateLabel}</small><span className={`status ${o.status.toLowerCase().replaceAll(" ", "-")}`}>{o.status}</span></div><b className="order-total">₹{o.total}</b></article>; })}</div>; }
