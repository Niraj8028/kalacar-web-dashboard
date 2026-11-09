import { useEffect, useMemo, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import type { Category } from "./categories";
import { Check, ImageField, SaveBar, SectionCard, TextField, ToggleText } from "./editor-fields";
import { MAX_HERO_SLIDES, NEW_HERO_SLIDE } from "./site-content-types";
import type { HeroSlide, HomeContent, ProductOption } from "./site-content-types";

function ProductPicker({ label, options, chosen, onChange, max }: { label: string; options: ProductOption[]; chosen: string[]; onChange: (ids: string[]) => void; max: number }) {
  return <fieldset className="product-picker"><legend>{label}</legend>
    {options.length ? options.map(option => <Check key={option.id} label={option.name} checked={chosen.includes(option.id)} onChange={on => onChange(on ? [...chosen, option.id].slice(0, max) : chosen.filter(id => id !== option.id))} />) : <p className="muted">Add products first.</p>}
  </fieldset>;
}

function CategoryImage({ category, onChanged }: { category: Category; onChanged: () => void }) {
  const [error, setError] = useState("");
  return <div><ImageField label={`${category.name} photo`} value={category.image} onChange={image => { setError(""); sendJson(`/api/admin/categories/${category.id}`, "PATCH", { image }).then(onChanged).catch(cause => setError(errorText(cause, "Could not save the photo."))); }} />{error && <small className="fulfillment-error" role="alert">{error}</small>}</div>;
}

/** A shop still on the old single-hero shape: show it as one slide. */
function withSlides(home: HomeContent): HomeContent {
  const hero = home.hero as HomeContent["hero"] & Partial<HeroSlide>;
  if (Array.isArray(hero.slides)) return home;
  const { show, ...slide } = hero as unknown as HeroSlide & { show: boolean };
  return { ...home, hero: { show, autoplay: true, interval: 5, slides: [{ ...NEW_HERO_SLIDE, ...slide }] } };
}

function HeroSlideEditor({ slide, index, total, products, onChange, onMove, onRemove }: { slide: HeroSlide; index: number; total: number; products: ProductOption[]; onChange: (change: Partial<HeroSlide>) => void; onMove: (step: -1 | 1) => void; onRemove: () => void }) {
  return <fieldset className="hero-slide-editor">
    <legend>Slide {index + 1}{slide.title ? ` · ${slide.title}` : ""}</legend>
    <ImageField label="Hero photo (used on phones, and on desktop if there's no wide photo)" value={slide.backgroundImage} onChange={backgroundImage => onChange({ backgroundImage })} />
    <ImageField label="Wide photo for desktop (optional: landscape, with the murti on the left, because the text sits on the right)" value={slide.desktopImage} onChange={desktopImage => onChange({ desktopImage })} />
    <ToggleText label="Small line" show={slide.showEyebrow} onShow={showEyebrow => onChange({ showEyebrow })} value={slide.eyebrow} onChange={eyebrow => onChange({ eyebrow })} max={60} />
    <ToggleText label="Main title" show={slide.showTitle} onShow={showTitle => onChange({ showTitle })} value={slide.title} onChange={title => onChange({ title })} max={120} />
    <ToggleText label="Description" show={slide.showDescription} onShow={showDescription => onChange({ showDescription })} value={slide.description} onChange={description => onChange({ description })} max={300} rows={2} />
    <label className="editor-field">Product for the Buy button<select value={slide.productId} onChange={event => onChange({ productId: event.target.value })}><option value="">No product (hides the Buy button)</option>{products.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select><small className="field-hint">Adds it to the bag and opens the bag. If it has several colours, the customer chooses one first.</small></label>
    <ToggleText label="Buy button" show={slide.buy.show} onShow={show => onChange({ buy: { ...slide.buy, show } })} value={slide.buy.label} onChange={label => onChange({ buy: { ...slide.buy, label } })} max={40} />
    <Check label="Show the price on the Buy button" checked={slide.buy.showPrice} onChange={showPrice => onChange({ buy: { ...slide.buy, showPrice } })} />
    <ToggleText label="Second button" show={slide.explore.show} onShow={show => onChange({ explore: { ...slide.explore, show } })} value={slide.explore.label} onChange={label => onChange({ explore: { ...slide.explore, label } })} max={40} />
    <TextField label="Second button link" value={slide.explore.link} onChange={link => onChange({ explore: { ...slide.explore, link } })} max={300} hint="#catalogue scrolls to the products on the same page. You can also use a page such as /about, or an https:// address." />
    <div className="hero-slide-actions">
      <button className="secondary" type="button" disabled={index === 0} onClick={() => onMove(-1)}>Move up</button>
      <button className="secondary" type="button" disabled={index === total - 1} onClick={() => onMove(1)}>Move down</button>
      <button className="secondary danger" type="button" disabled={total === 1} onClick={() => { if (window.confirm(`Remove slide ${index + 1}?`)) onRemove(); }}>Remove slide</button>
    </div>
  </fieldset>;
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
    getJson<{ home: HomeContent }>("/api/admin/site-content", "Settings are unavailable right now.").then(data => { if (active) { const home = withSlides(data.home); setSaved(home); setDraft(home); } }).catch(cause => { if (active) setError(errorText(cause, "Settings are unavailable right now.")); });
    void loadCategories();
    return () => { active = false; };
  }, []);
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  if (!draft || !saved) return error ? <p className="order-detail-error" role="alert">{error}</p> : <p className="muted">Loading the home page…</p>;
  const set = <K extends keyof HomeContent>(key: K, change: Partial<HomeContent[K]>) => { setDraft(current => current && { ...current, [key]: { ...current[key], ...change } }); setMessage(""); };
  const { hero, firstLaunch, comingSoon, collections, why, reviews, story } = draft;
  const setSlides = (slides: HeroSlide[]) => set("hero", { slides });
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
      <p className="muted">Add up to {MAX_HERO_SLIDES} slides. With more than one, customers can swipe between them, and they can also change by themselves.</p>
      <Check label="Change slides automatically" hint="Pauses while a customer is touching or pointing at the hero." checked={hero.autoplay} onChange={autoplay => set("hero", { autoplay })} />
      {hero.autoplay && <label className="editor-field">Seconds per slide<input type="number" min={3} max={15} value={hero.interval} onChange={event => set("hero", { interval: Math.min(15, Math.max(3, Number(event.target.value) || 5)) })} /></label>}
      {hero.slides.map((slide, index) => <HeroSlideEditor key={index} slide={slide} index={index} total={hero.slides.length} products={products}
        onChange={change => setSlides(hero.slides.map((other, i) => i === index ? { ...other, ...change } : other))}
        onMove={step => { const next = [...hero.slides]; [next[index], next[index + step]] = [next[index + step], next[index]]; setSlides(next); }}
        onRemove={() => setSlides(hero.slides.filter((_, i) => i !== index))} />)}
      {hero.slides.length < MAX_HERO_SLIDES && <button className="secondary" type="button" onClick={() => setSlides([...hero.slides, { ...NEW_HERO_SLIDE }])}>+ Add slide</button>}
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
      <p className="muted">Add reviews in the Reviews section and tick "Show on home page". Video covers come from the video automatically.</p>
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
