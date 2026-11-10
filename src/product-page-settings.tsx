import { useEffect, useMemo, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { Check, ImageField, SaveBar, TextField } from "./editor-fields";
import { DEFAULT_ACTIVITY } from "./site-content-types";
import type { ProductPageContent } from "./site-content-types";

const ACTIVITY_KEYS = ["viewers", "recentSales", "soldThisWeek"] as const;
const withActivityDefaults = (page: ProductPageContent): ProductPageContent => ({ ...page, viewers: { ...DEFAULT_ACTIVITY.viewers, ...page.viewers }, recentSales: { ...DEFAULT_ACTIVITY.recentSales, ...page.recentSales }, soldThisWeek: { ...DEFAULT_ACTIVITY.soldThisWeek, ...page.soldThisWeek } });
const isActivity = (key: string) => (ACTIVITY_KEYS as readonly string[]).includes(key);

/**
 * Settings shared by every product page. "activity" shows only the pop-up, viewers and sold-count
 * switches (Settings → Activity); "page" shows the rest. Each saves only its own part, on top of the latest saved settings.
 */
export function ProductPageSettingsPanel({ part = "page" }: { part?: "page" | "activity" }) {
  const [saved, setSaved] = useState<ProductPageContent | null>(null);
  const [draft, setDraft] = useState<ProductPageContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    getJson<{ productPage: ProductPageContent }>("/api/admin/site-content", "Settings are unavailable right now.").then(data => { if (active) { const page = withActivityDefaults(data.productPage); setSaved(page); setDraft(page); } }).catch(cause => { if (active) setError(errorText(cause, "Settings are unavailable right now.")); });
    return () => { active = false; };
  }, []);
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const titleId = `product-page-${part}-title`;
  const shell = (children: React.ReactNode) => <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby={titleId}><div className="panel-head"><div><p className="overline">{part === "activity" ? "WHOLE SHOP" : "EVERY PRODUCT"}</p><h2 id={titleId}>{part === "activity" ? "Shop activity" : "Product page settings"}</h2></div></div>{children}</section>;
  if (!draft || !saved) return shell(error ? <p className="order-detail-error" role="alert">{error}</p> : <p className="muted">Loading settings…</p>);
  const set = <K extends keyof ProductPageContent>(key: K, change: Partial<ProductPageContent[K]>) => { setDraft(current => current && { ...current, [key]: { ...current[key], ...change } }); setMessage(""); };
  const { offer, howMade, faqs, viewers, recentSales, soldThisWeek, lowStock, stickyBar, endLink, whatsappHelp } = draft;
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      // The other settings card may have saved since this one loaded, so only this card's fields are changed.
      const latest = await getJson<{ productPage: ProductPageContent }>("/api/admin/site-content", "Settings are unavailable right now.");
      const mine = Object.fromEntries(Object.entries(draft!).filter(([key]) => isActivity(key) === (part === "activity")));
      const data = await sendJson<{ productPage: ProductPageContent }>("/api/admin/site-content", "PATCH", { productPage: { ...withActivityDefaults(latest.productPage), ...mine } });
      const page = withActivityDefaults(data.productPage);
      setSaved(page); setDraft(page); setMessage(part === "activity" ? "Saved. The shop is updated." : "Saved. Every product page is updated.");
    }
    catch (cause) { setError(errorText(cause, "Could not save settings.")); }
    finally { setBusy(false); }
  }
  const saveBar = <SaveBar dirty={dirty} busy={busy} message={message} error={error} onUndo={() => { setDraft(saved); setMessage(""); setError(""); }} onSave={() => void save()} label={part === "activity" ? "Save shop activity" : "Save product page settings"} />;
  const number = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value) || min));
  if (part === "activity") return shell(<>
    <p className="muted">These use real orders and real visitors only, and stay hidden until there's something true to show.</p>
    <fieldset className="editor-group"><legend>Purchase pop-up</legend>
      <Check label="Show recent purchases" checked={recentSales.show} onChange={show => set("recentSales", { show })} hint="Paid orders from the last 7 days, e.g. “Someone has bought Cute Krishna · 25 minutes ago”." />
      <Check label="Show the murti's photo" checked={recentSales.showImage} onChange={showImage => set("recentSales", { showImage })} />
      <Check label="Include the customer's first name" checked={recentSales.showFirstName} onChange={showFirstName => set("recentSales", { showFirstName })} hint="Off shows &quot;Someone&quot;. Mention this in your Privacy page before turning it on." />
      <Check label="Also show on the home page" checked={recentSales.everyPage} onChange={everyPage => set("recentSales", { everyPage })} hint="Off shows it on product pages only." />
      <label className="editor-field">Seconds before each pop-up<input type="number" min={3} max={120} value={recentSales.delay} onChange={event => set("recentSales", { delay: number(Number(event.target.value), 3, 120) })} /></label>
      <label className="editor-field">Seconds each pop-up stays<input type="number" min={3} max={30} value={recentSales.duration} onChange={event => set("recentSales", { duration: number(Number(event.target.value), 3, 30) })} /></label>
      <label className="editor-field">Size<select value={recentSales.size} onChange={event => set("recentSales", { size: event.target.value as typeof recentSales.size })}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
    </fieldset>
    <fieldset className="editor-group"><legend>Sold count on the product page</legend>
      <Check label="Show how many sold recently" checked={soldThisWeek.show} onChange={show => set("soldThisWeek", { show })} hint="Shown in red beside the rating, e.g. “22 sold in last 12 hours”." />
      <label className="editor-field">Count sales from the last … hours<input type="number" min={1} max={720} value={soldThisWeek.hours} onChange={event => set("soldThisWeek", { hours: number(Number(event.target.value), 1, 720) })} /><small className="field-hint">12 = last 12 hours, 168 = last 7 days, 720 = last 30 days.</small></label>
      <label className="editor-field">Only show from this many sold<input type="number" min={1} max={1000} value={soldThisWeek.minimum} onChange={event => set("soldThisWeek", { minimum: number(Number(event.target.value), 1, 1000) })} /></label>
    </fieldset>
    <fieldset className="editor-group"><legend>People viewing</legend>
      <Check label="Show how many people are viewing" checked={viewers.show} onChange={show => set("viewers", { show })} hint="Real visitors on that product page right now, shown under the price. Needs live updates (Pusher) set up on the server." />
      <label className="editor-field">Only show from this many viewers<input type="number" min={2} max={100} value={viewers.minimum} onChange={event => set("viewers", { minimum: number(Number(event.target.value), 2, 100) })} /><small className="field-hint">With few visitors at once, this stays hidden. 2 is the lowest.</small></label>
    </fieldset>
    {saveBar}
  </>);
  return shell(<>
    <p className="muted">These appear on every product. Description, bundles and reviews are set per product. Pop-ups, viewers and sold counts are in Settings → Activity.</p>
    <fieldset className="editor-group"><legend>Offer under Add to bag</legend><Check label="Show the offer" checked={offer.show} onChange={show => set("offer", { show })} /><TextField label="Title" value={offer.title} max={60} onChange={title => set("offer", { title })} /><TextField label="Offer text" value={offer.text} max={240} rows={2} placeholder="e.g. ₹200 off on orders above ₹1,500. Use code…" onChange={text => set("offer", { text })} hint="Make sure a matching coupon exists in Coupons." /></fieldset>
    <fieldset className="editor-group"><legend>How it's made</legend><Check label="Show this section" checked={howMade.show} onChange={show => set("howMade", { show })} /><TextField label="Title" value={howMade.title} max={80} onChange={title => set("howMade", { title })} /><TextField label="Founder's message" value={howMade.message} max={1200} rows={4} onChange={message => set("howMade", { message })} /><TextField label="Founder's name" value={howMade.founder} max={80} onChange={founder => set("howMade", { founder })} /><Check label="Show photo" checked={howMade.showImage} onChange={showImage => set("howMade", { showImage })} /><ImageField label="Founder photo" value={howMade.image} onChange={image => set("howMade", { image })} /></fieldset>
    <fieldset className="editor-group"><legend>FAQs</legend><Check label="Show FAQs" checked={faqs.show} onChange={show => set("faqs", { show })} /><TextField label="Title" value={faqs.title} max={80} onChange={title => set("faqs", { title })} />
      {faqs.items.map((item, index) => <div className="editor-row" key={index}><TextField label="Question" value={item.question} max={160} onChange={question => set("faqs", { items: faqs.items.map((other, i) => i === index ? { ...other, question } : other) })} /><TextField label="Answer" value={item.answer} max={800} rows={2} onChange={answer => set("faqs", { items: faqs.items.map((other, i) => i === index ? { ...other, answer } : other) })} /><button className="text-button" type="button" onClick={() => set("faqs", { items: faqs.items.filter((_, i) => i !== index) })}>Remove</button></div>)}
      <button className="secondary" type="button" disabled={faqs.items.length >= 20} onClick={() => set("faqs", { items: [...faqs.items, { question: "", answer: "" }] })}>+ Add question</button></fieldset>
    <fieldset className="editor-group"><legend>Low stock message</legend><label className="editor-field">Show when stock is at or below<input type="number" min={0} max={100} value={lowStock.threshold} onChange={event => set("lowStock", { threshold: Number(event.target.value) })} /></label><TextField label="Message" value={lowStock.text} max={80} onChange={text => set("lowStock", { text })} hint="{count} becomes the real number left." /></fieldset>
    <fieldset className="editor-group"><legend>Page extras</legend><Check label="Sticky Add to bag bar when scrolling" checked={stickyBar.show} onChange={show => set("stickyBar", { show })} /><Check label="Button at the end of the page" checked={endLink.show} onChange={show => set("endLink", { show })} /><TextField label="Button text" value={endLink.label} max={60} onChange={label => set("endLink", { label })} /><TextField label="Button link" value={endLink.link} max={300} onChange={link => set("endLink", { link })} /><Check label="WhatsApp help button" checked={whatsappHelp.show} onChange={show => set("whatsappHelp", { show })} /><TextField label="WhatsApp button text" value={whatsappHelp.label} max={80} onChange={label => set("whatsappHelp", { label })} /></fieldset>
    {saveBar}
  </>);
}
