import { useEffect, useMemo, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { Check, ImageField, SaveBar, TextField } from "./editor-fields";
import type { ProductPageContent } from "./site-content-types";

/** Settings shared by every product page. */
export function ProductPageSettingsPanel() {
  const [saved, setSaved] = useState<ProductPageContent | null>(null);
  const [draft, setDraft] = useState<ProductPageContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    getJson<{ productPage: ProductPageContent }>("/api/admin/site-content", "Settings are unavailable right now.").then(data => { if (active) { setSaved(data.productPage); setDraft(data.productPage); } }).catch(cause => { if (active) setError(errorText(cause, "Settings are unavailable right now.")); });
    return () => { active = false; };
  }, []);
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const shell = (children: React.ReactNode) => <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="product-page-title"><div className="panel-head"><div><p className="overline">EVERY PRODUCT</p><h2 id="product-page-title">Product page settings</h2></div></div>{children}</section>;
  if (!draft || !saved) return shell(error ? <p className="order-detail-error" role="alert">{error}</p> : <p className="muted">Loading settings…</p>);
  const set = <K extends keyof ProductPageContent>(key: K, change: Partial<ProductPageContent[K]>) => { setDraft(current => current && { ...current, [key]: { ...current[key], ...change } }); setMessage(""); };
  const { offer, howMade, faqs, viewers, recentSales, soldThisWeek, lowStock, stickyBar, endLink, whatsappHelp } = draft;
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try { const data = await sendJson<{ productPage: ProductPageContent }>("/api/admin/site-content", "PATCH", { productPage: draft }); setSaved(data.productPage); setDraft(data.productPage); setMessage("Saved. Every product page is updated."); }
    catch (cause) { setError(errorText(cause, "Could not save settings.")); }
    finally { setBusy(false); }
  }
  return shell(<>
    <p className="muted">These appear on every product. Description, bundles and reviews are set per product.</p>
    <fieldset className="editor-group"><legend>Offer under Add to bag</legend><Check label="Show the offer" checked={offer.show} onChange={show => set("offer", { show })} /><TextField label="Title" value={offer.title} max={60} onChange={title => set("offer", { title })} /><TextField label="Offer text" value={offer.text} max={240} rows={2} placeholder="e.g. ₹200 off on orders above ₹1,500. Use code…" onChange={text => set("offer", { text })} hint="Make sure a matching coupon exists in Coupons." /></fieldset>
    <fieldset className="editor-group"><legend>How it's made</legend><Check label="Show this section" checked={howMade.show} onChange={show => set("howMade", { show })} /><TextField label="Title" value={howMade.title} max={80} onChange={title => set("howMade", { title })} /><TextField label="Founder's message" value={howMade.message} max={1200} rows={4} onChange={message => set("howMade", { message })} /><TextField label="Founder's name" value={howMade.founder} max={80} onChange={founder => set("howMade", { founder })} /><Check label="Show photo" checked={howMade.showImage} onChange={showImage => set("howMade", { showImage })} /><ImageField label="Founder photo" value={howMade.image} onChange={image => set("howMade", { image })} /></fieldset>
    <fieldset className="editor-group"><legend>FAQs</legend><Check label="Show FAQs" checked={faqs.show} onChange={show => set("faqs", { show })} /><TextField label="Title" value={faqs.title} max={80} onChange={title => set("faqs", { title })} />
      {faqs.items.map((item, index) => <div className="editor-row" key={index}><TextField label="Question" value={item.question} max={160} onChange={question => set("faqs", { items: faqs.items.map((other, i) => i === index ? { ...other, question } : other) })} /><TextField label="Answer" value={item.answer} max={800} rows={2} onChange={answer => set("faqs", { items: faqs.items.map((other, i) => i === index ? { ...other, answer } : other) })} /><button className="text-button" type="button" onClick={() => set("faqs", { items: faqs.items.filter((_, i) => i !== index) })}>Remove</button></div>)}
      <button className="secondary" type="button" disabled={faqs.items.length >= 20} onClick={() => set("faqs", { items: [...faqs.items, { question: "", answer: "" }] })}>+ Add question</button></fieldset>
    <fieldset className="editor-group"><legend>Real activity</legend><p className="muted">These use real data only, and stay hidden until there's something true to show.</p>
      <Check label="Show how many people are viewing" checked={viewers.show} onChange={show => set("viewers", { show })} hint="Real visitors on that page now. Needs live updates." />
      <label className="editor-field">Only show from this many viewers<input type="number" min={2} max={100} value={viewers.minimum} onChange={event => set("viewers", { minimum: Number(event.target.value) })} /></label>
      <Check label="Show recent purchases" checked={recentSales.show} onChange={show => set("recentSales", { show })} hint="Paid orders from the last 7 days." />
      <Check label="Include the customer's first name" checked={recentSales.showFirstName} onChange={showFirstName => set("recentSales", { showFirstName })} hint="Off shows &quot;Someone&quot;. Mention this in your Privacy page before turning it on." />
      <Check label="Show how many sold this week" checked={soldThisWeek.show} onChange={show => set("soldThisWeek", { show })} />
      <label className="editor-field">Only show from this many sold<input type="number" min={1} max={1000} value={soldThisWeek.minimum} onChange={event => set("soldThisWeek", { minimum: Number(event.target.value) })} /></label>
    </fieldset>
    <fieldset className="editor-group"><legend>Low stock message</legend><label className="editor-field">Show when stock is at or below<input type="number" min={0} max={100} value={lowStock.threshold} onChange={event => set("lowStock", { threshold: Number(event.target.value) })} /></label><TextField label="Message" value={lowStock.text} max={80} onChange={text => set("lowStock", { text })} hint="{count} becomes the real number left." /></fieldset>
    <fieldset className="editor-group"><legend>Page extras</legend><Check label="Sticky Add to bag bar when scrolling" checked={stickyBar.show} onChange={show => set("stickyBar", { show })} /><Check label="Button at the end of the page" checked={endLink.show} onChange={show => set("endLink", { show })} /><TextField label="Button text" value={endLink.label} max={60} onChange={label => set("endLink", { label })} /><TextField label="Button link" value={endLink.link} max={300} onChange={link => set("endLink", { link })} /><Check label="WhatsApp help button" checked={whatsappHelp.show} onChange={show => set("whatsappHelp", { show })} /><TextField label="WhatsApp button text" value={whatsappHelp.label} max={80} onChange={label => set("whatsappHelp", { label })} /></fieldset>
    <SaveBar dirty={dirty} busy={busy} message={message} error={error} onUndo={() => { setDraft(saved); setMessage(""); setError(""); }} onSave={() => void save()} label="Save product page settings" />
  </>);
}
