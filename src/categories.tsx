import { useEffect, useState } from "react";
import type { FormEvent } from "react";

export type Category = { id: number; name: string; productCount: number; image: string };

export async function loadCategories(): Promise<Category[]> {
  const response = await fetch("/api/admin/categories", { cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { categories?: Category[]; error?: string };
  if (!response.ok || !data.categories) throw new Error(data.error || "Categories are unavailable right now.");
  return data.categories;
}

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error || "That didn't save. Please try again.");
}

function CategoryRow({ category, onChanged }: { category: Category; onChanged: () => Promise<void> }) {
  const [name, setName] = useState(category.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = name.trim() !== category.name;
  const used = category.productCount > 0;
  async function act(work: () => Promise<void>) {
    setBusy(true); setError("");
    try { await work(); await onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn't save. Please try again."); }
    finally { setBusy(false); }
  }
  return <li className={`category-row${changed ? " changed" : ""}`}>
    <div className="category-row-main">
      <input aria-label={`Name of category ${category.name}`} maxLength={80} value={name} disabled={busy} onChange={event => { setName(event.target.value); setError(""); }} />
      <span className="category-count">{category.productCount} {category.productCount === 1 ? "product" : "products"}</span>
      <div className="category-row-actions">
        {changed && <button className="text-button" type="button" disabled={busy} onClick={() => { setName(category.name); setError(""); }}>Undo</button>}
        <button className="secondary" type="button" disabled={!changed || busy} onClick={() => void act(() => send(`/api/admin/categories/${category.id}`, "PATCH", { name }))}>Save</button>
        <button className="secondary" type="button" disabled={used || busy} title={used ? "Move its products to another category first" : undefined} onClick={() => void act(() => send(`/api/admin/categories/${category.id}`, "DELETE"))}>Delete</button>
      </div>
    </div>
    {changed && used && <small className="fulfillment-note">Saving also updates {category.productCount === 1 ? "its product" : `its ${category.productCount} products`}.</small>}
    {error && <small className="fulfillment-error" role="alert">{error}</small>}
  </li>;
}

/** Settings panel: the owner's categories, used by the product editor and every filter. */
export function CategoriesPanel() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh() { setCategories(await loadCategories()); }
  useEffect(() => {
    let active = true;
    loadCategories().then(list => { if (active) setCategories(list); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Categories are unavailable right now."); });
    return () => { active = false; };
  }, []);
  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try { await send("/api/admin/categories", "POST", { name }); setName(""); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That didn't save. Please try again."); }
    finally { setBusy(false); }
  }
  return <section className="panel settings-card" aria-labelledby="categories-title">
    <div className="panel-head"><div><p className="overline">CATALOGUE</p><h2 id="categories-title">Categories</h2></div></div>
    <p className="muted">Choose from these when adding a product. Customers see them as shop filters once a product uses them.</p>
    <form className="category-add" onSubmit={add}>
      <input aria-label="New category name" required minLength={2} maxLength={80} placeholder="e.g. Ganpati" value={name} disabled={busy} onChange={event => { setName(event.target.value); setError(""); }} />
      <button className="primary" type="submit" disabled={busy || name.trim().length < 2}>{busy ? "Adding…" : "Add category"}</button>
    </form>
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {!categories ? !error && <p className="muted">Loading categories…</p> : categories.length ? <ul className="category-list">{categories.map(category => <CategoryRow key={`${category.id}-${category.name}`} category={category} onChanged={refresh} />)}</ul> : <p className="muted">No categories yet. Add your first one above.</p>}
  </section>;
}
