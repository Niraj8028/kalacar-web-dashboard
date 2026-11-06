import { useEffect, useMemo, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import type { Category } from "./categories";
import { Check, ImageField, SaveBar, SectionCard, TextField, ToggleText } from "./editor-fields";
import type { HomeContent, ProductOption } from "./site-content-types";

function ProductPicker({ label, options, chosen, onChange, max }: { label: string; options: ProductOption[]; chosen: string[]; onChange: (ids: string[]) => void; max: number }) {
  return <fieldset className="product-picker"><legend>{label}</legend>
    {options.length ? options.map(option => <Check key={option.id} label={option.name} checked={chosen.includes(option.id)} onChange={on => onChange(on ? [...chosen, option.id].slice(0, max) : chosen.filter(id => id !== option.id))} />) : <p className="muted">Add products first.</p>}
  </fieldset>;
}

function CategoryImage({ category, onChanged }: { category: Category; onChanged: () => void }) {
  const [error, setError] = useState("");
  return <div><ImageField label={`${category.name} photo`} value={category.image} onChange={image => { setError(""); sendJson(`/api/admin/categories/${category.id}`, "PATCH", { image }).then(onChanged).catch(cause => setError(errorText(cause, "Could not save the photo."))); }} />{error && <small className="fulfillment-error" role="alert">{error}</small>}</div>;
}

export function HomeEditor({ products }: { products: ProductOption[] }) {
  const [saved, setSaved] = useState<HomeContent | null>(null);
  const [draft, setDraft] = useState<HomeContent | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const loadCategories = () => getJson<{ categories: Category[] }>("/api/admin/categories", "Categories are unavailable.").then(data => setCategories(data.categories)).catch(() => undefined);
  useEffect(() => {
    let active = true;
    getJson<{ home: HomeContent }>("/api/admin/site-content", "Settings are unavailable right now.").then(data => { if (active) { setSaved(data.home); setDraft(data.home); } }).catch(cause => { if (active) setError(errorText(cause, "Settings are unavailable right now.")); });
    void loadCategories();
    return () => { active = false; };
  }, []);
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  if (!draft || !saved) return error ? <p className="order-detail-error" role="alert">{error}</p> : <p className="muted">Loading the home page…</p>;
  const set = <K extends keyof HomeContent>(key: K, change: Partial<HomeContent[K]>) => { setDraft(current => current && { ...current, [key]: { ...current[key], ...change } }); setMessage(""); };
  const { hero, firstLaunch, comingSoon, collections, why, reviews, story } = draft;
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try { const data = await sendJson<{ home: HomeContent }>("/api/admin/site-content", "PATCH", { home: draft }); setSaved(data.home); setDraft(data.home); setMessage("Saved. The home page is updated."); }
    catch (cause) { setError(errorText(cause, "Could not save the home page.")); }
    finally { setBusy(false); }
  }
  const heading = (section: "firstLaunch" | "comingSoon" | "collections" | "why" | "reviews") => <>
    <ToggleText label="Section title" show={draft[section].showTitle} onShow={showTitle => set(section, { showTitle })} value={draft[section].title} onChange={title => set(section, { title })} max={120} />
    <ToggleText label="Short description" show={draft[section].showDescription} onShow={showDescription => set(section, { showDescription })} value={draft[section].description} onChange={description => set(section, { description })} max={400} rows={2} />
  </>;
  return <div className="editor-stack">
    <SectionCard overline="TOP OF THE PAGE" title="Hero" show={hero.show} onShow={show => set("hero", { show })}>
      <ImageField label="Hero photo (used on phones, and on desktop if there's no wide photo)" value={hero.backgroundImage} onChange={backgroundImage => set("hero", { backgroundImage })} />
      <ImageField label="Wide photo for desktop (optional, landscape)" value={hero.desktopImage} onChange={desktopImage => set("hero", { desktopImage })} />
      <ToggleText label="Small line" show={hero.showEyebrow} onShow={showEyebrow => set("hero", { showEyebrow })} value={hero.eyebrow} onChange={eyebrow => set("hero", { eyebrow })} max={60} />
      <ToggleText label="Main title" show={hero.showTitle} onShow={showTitle => set("hero", { showTitle })} value={hero.title} onChange={title => set("hero", { title })} max={120} />
      <ToggleText label="Description" show={hero.showDescription} onShow={showDescription => set("hero", { showDescription })} value={hero.description} onChange={description => set("hero", { description })} max={300} rows={2} />
      <label className="editor-field">Product for the Buy button<select value={hero.productId} onChange={event => set("hero", { productId: event.target.value })}><option value="">No product (hides the Buy button)</option>{products.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select><small className="field-hint">Adds it to the bag and opens the bag. If it has several colours, the customer chooses one first.</small></label>
      <ToggleText label="Buy button" show={hero.buy.show} onShow={show => set("hero", { buy: { ...hero.buy, show } })} value={hero.buy.label} onChange={label => set("hero", { buy: { ...hero.buy, label } })} max={40} />
      <Check label="Show the price on the Buy button" checked={hero.buy.showPrice} onChange={showPrice => set("hero", { buy: { ...hero.buy, showPrice } })} />
      <ToggleText label="Second button" show={hero.explore.show} onShow={show => set("hero", { explore: { ...hero.explore, show } })} value={hero.explore.label} onChange={label => set("hero", { explore: { ...hero.explore, label } })} max={40} />
      <TextField label="Second button link" value={hero.explore.link} onChange={link => set("hero", { explore: { ...hero.explore, link } })} max={300} hint="#catalogue scrolls to the products on the same page. You can also use a page such as /about, or an https:// address." />
    </SectionCard>
    <SectionCard overline="PRODUCTS" title="First launch grid" show={firstLaunch.show} onShow={show => set("firstLaunch", { show })}>
      {heading("firstLaunch")}
      <ProductPicker label="Products to show (up to 12)" options={products} chosen={firstLaunch.productIds} onChange={productIds => set("firstLaunch", { productIds })} max={12} />
    </SectionCard>
    <SectionCard overline="UPCOMING" title="Coming Soon" show={comingSoon.show} onShow={show => set("comingSoon", { show })}>
      {heading("comingSoon")}
      <p className="muted">Shows only a photo and name, with "Coming Soon" in place of the price, stars and button.</p>
      {comingSoon.items.map((item, index) => <div className="editor-row" key={index}>
        <TextField label="Name" value={item.name} max={80} onChange={name => set("comingSoon", { items: comingSoon.items.map((other, i) => i === index ? { ...other, name } : other) })} />
        <ImageField label="Photo" value={item.image} onChange={image => set("comingSoon", { items: comingSoon.items.map((other, i) => i === index ? { ...other, image } : other) })} />
        <button className="text-button" type="button" onClick={() => set("comingSoon", { items: comingSoon.items.filter((_, i) => i !== index) })}>Remove</button>
      </div>)}
      <button className="secondary" type="button" disabled={comingSoon.items.length >= 12} onClick={() => set("comingSoon", { items: [...comingSoon.items, { name: "", image: "" }] })}>+ Add upcoming murti</button>
    </SectionCard>
    <SectionCard overline="CATEGORIES" title="Collections" show={collections.show} onShow={show => set("collections", { show })}>
      {heading("collections")}
      <p className="muted">Shown as cards: the first is large, with the others beside it. Only categories with products appear. Photos save straight away. Add or rename categories in Settings.</p>
      <div className="editor-image-grid">{categories.map(category => <CategoryImage key={category.id} category={category} onChanged={() => void loadCategories()} />)}</div>
    </SectionCard>
    <SectionCard overline="TRUST" title="Why choose us" show={why.show} onShow={show => set("why", { show })}>
      {heading("why")}
      {why.items.map((item, index) => <div className="editor-row" key={index}>
        <TextField label="Title" value={item.title} max={80} onChange={title => set("why", { items: why.items.map((other, i) => i === index ? { ...other, title } : other) })} />
        <TextField label="Text" value={item.text} max={240} rows={2} onChange={text => set("why", { items: why.items.map((other, i) => i === index ? { ...other, text } : other) })} />
        <button className="text-button" type="button" onClick={() => set("why", { items: why.items.filter((_, i) => i !== index) })}>Remove</button>
      </div>)}
      <button className="secondary" type="button" disabled={why.items.length >= 8} onClick={() => set("why", { items: [...why.items, { title: "", text: "" }] })}>+ Add reason</button>
    </SectionCard>
    <SectionCard overline="CUSTOMERS" title="Reviews and videos" show={reviews.show} onShow={show => set("reviews", { show })}>
      {heading("reviews")}
      <Check label="Show written reviews" checked={reviews.showText} onChange={showText => set("reviews", { showText })} />
      <Check label="Show video reviews" checked={reviews.showVideo} onChange={showVideo => set("reviews", { showVideo })} />
      <p className="muted">Add reviews in the Reviews section and tick "Show on home page".</p>
    </SectionCard>
    <SectionCard overline="ABOUT" title="Our Story" show={story.show} onShow={show => set("story", { show })}>
      <ToggleText label="Title" show={story.showTitle} onShow={showTitle => set("story", { showTitle })} value={story.title} onChange={title => set("story", { title })} max={120} />
      <ToggleText label="Story" show={story.showText} onShow={showText => set("story", { showText })} value={story.text} onChange={text => set("story", { text })} max={2000} rows={6} />
      <Check label="Show founder photo" checked={story.showImage} onChange={showImage => set("story", { showImage })} />
      <ImageField label="Founder photo" value={story.image} onChange={image => set("story", { image })} />
      <ToggleText label="Founder name" show={story.showFounder} onShow={showFounder => set("story", { showFounder })} value={story.founder} onChange={founder => set("story", { founder })} max={80} />
    </SectionCard>
    <div className="panel editor-sticky-save"><SaveBar dirty={dirty} busy={busy} message={message} error={error} onUndo={() => { setDraft(saved); setMessage(""); setError(""); }} onSave={() => void save()} label="Save home page" /></div>
  </div>;
}
