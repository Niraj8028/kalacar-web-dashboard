import { useEffect, useMemo, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { Check, ImageField, SaveBar, TextField } from "./editor-fields";
import { DEFAULT_ACTIVITY, DEFAULT_DELIVERY, DEFAULT_EYEBROW, DEFAULT_GOOGLE_REVIEWS, DEFAULT_IN_STOCK, DEFAULT_STOCK_COUNT, DEFAULT_TRUST, MAX_TRUST_ITEMS, TRUST_ICONS, type TrustItem } from "./site-content-types";
import type { ProductPageContent } from "./site-content-types";

const ACTIVITY_KEYS = ["viewers", "recentSales", "soldThisWeek"] as const;
const withActivityDefaults = (page: ProductPageContent): ProductPageContent => ({ ...page, viewers: { ...DEFAULT_ACTIVITY.viewers, ...page.viewers }, recentSales: { ...DEFAULT_ACTIVITY.recentSales, ...page.recentSales }, soldThisWeek: { ...DEFAULT_ACTIVITY.soldThisWeek, ...page.soldThisWeek }, eyebrow: { ...DEFAULT_EYEBROW, ...page.eyebrow }, stockCount: { ...DEFAULT_STOCK_COUNT, ...page.stockCount }, googleReviews: { ...DEFAULT_GOOGLE_REVIEWS, ...page.googleReviews }, delivery: { ...DEFAULT_DELIVERY, ...page.delivery, free: { ...DEFAULT_DELIVERY.free, ...page.delivery?.free }, freeUnderStock: { ...DEFAULT_DELIVERY.freeUnderStock, ...page.delivery?.freeUnderStock } }, inStock: { ...DEFAULT_IN_STOCK, ...page.inStock },
  trustStrip: { ...DEFAULT_TRUST.trustStrip, ...page.trustStrip }, deliveryDates: { ...DEFAULT_TRUST.deliveryDates, ...page.deliveryDates }, freeGift: { ...DEFAULT_TRUST.freeGift, ...page.freeGift },
  whatsappFloat: { ...DEFAULT_TRUST.whatsappFloat, ...page.whatsappFloat }, leaveSurvey: { ...DEFAULT_TRUST.leaveSurvey, ...page.leaveSurvey }, preDispatch: { ...DEFAULT_TRUST.preDispatch, ...page.preDispatch } });
const hourLabel = (hour: number) => `${hour % 12 || 12}${hour < 12 ? " AM" : " PM"}`;
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
  const { offer, howMade, faqs, viewers, recentSales, soldThisWeek, lowStock, stickyBar, endLink, whatsappHelp, eyebrow, stockCount, googleReviews, delivery, inStock, trustStrip, deliveryDates, freeGift, whatsappFloat, leaveSurvey, preDispatch } = draft;
  const editTrust = (index: number, change: Partial<TrustItem>) => set("trustStrip", { items: trustStrip.items.map((item, i) => i === index ? { ...item, ...change } : item) });
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
    <fieldset className="editor-group"><legend>Line above the product name</legend><Check label="Show this line" checked={eyebrow.show} onChange={show => set("eyebrow", { show })} /><TextField label="Text" value={eyebrow.text} max={80} onChange={text => set("eyebrow", { text })} hint="{category} becomes the product's category, e.g. “Krishna · SMALL DEVOTIONAL MURTI”." /></fieldset>
    <fieldset className="editor-group"><legend>Offer under Add to bag</legend><Check label="Show the offer" checked={offer.show} onChange={show => set("offer", { show })} /><TextField label="Title" value={offer.title} max={60} onChange={title => set("offer", { title })} /><TextField label="Offer text" value={offer.text} max={240} rows={2} placeholder="e.g. ₹200 off on orders above ₹1,500. Use code…" onChange={text => set("offer", { text })} hint="Make sure a matching coupon exists in Coupons." /></fieldset>
    <fieldset className="editor-group"><legend>How it's made</legend><Check label="Show this section" checked={howMade.show} onChange={show => set("howMade", { show })} /><TextField label="Title" value={howMade.title} max={80} onChange={title => set("howMade", { title })} /><TextField label="Founder's message" value={howMade.message} max={1200} rows={4} onChange={message => set("howMade", { message })} /><TextField label="Founder's name" value={howMade.founder} max={80} onChange={founder => set("howMade", { founder })} /><Check label="Show photo" checked={howMade.showImage} onChange={showImage => set("howMade", { showImage })} /><ImageField label="Founder photo" value={howMade.image} onChange={image => set("howMade", { image })} /></fieldset>
    <fieldset className="editor-group"><legend>FAQs</legend><Check label="Show FAQs" checked={faqs.show} onChange={show => set("faqs", { show })} /><TextField label="Title" value={faqs.title} max={80} onChange={title => set("faqs", { title })} />
      {faqs.items.map((item, index) => <div className="editor-row" key={index}><TextField label="Question" value={item.question} max={160} onChange={question => set("faqs", { items: faqs.items.map((other, i) => i === index ? { ...other, question } : other) })} /><TextField label="Answer" value={item.answer} max={800} rows={2} onChange={answer => set("faqs", { items: faqs.items.map((other, i) => i === index ? { ...other, answer } : other) })} /><button className="text-button" type="button" onClick={() => set("faqs", { items: faqs.items.filter((_, i) => i !== index) })}>Remove</button></div>)}
      <button className="secondary" type="button" disabled={faqs.items.length >= 20} onClick={() => set("faqs", { items: [...faqs.items, { question: "", answer: "" }] })}>+ Add question</button></fieldset>
    <fieldset className="editor-group"><legend>Delivery</legend><TextField label="Delivery time" value={delivery.estimate} max={60} onChange={estimate => set("delivery", { estimate })} hint="Shown as “Delivered in 3–7 business days.” on the product page, bag, checkout, order confirmed page and order email." /><TextField label="Line after the delivery time" value={delivery.note} max={160} onChange={note => set("delivery", { note })} hint="Optional. Leave empty to hide it." /><Check label="Show “Free delivery” in the delivery line" checked={delivery.free.show} onChange={show => set("delivery", { free: { ...delivery.free, show } })} hint="In green at the start: “Free delivery across India. Delivered in 3–7 business days.”" /><Check label="Also show “Free delivery” under “In stock”" checked={delivery.freeUnderStock.show} onChange={show => set("delivery", { freeUnderStock: { show } })} hint="A green ✓ line just above Add to bag." /><TextField label="Free delivery text" value={delivery.free.text} max={60} onChange={text => set("delivery", { free: { ...delivery.free, text } })} /></fieldset>
    <fieldset className="editor-group"><legend>Delivery dates</legend>
      <Check label="Show delivery dates instead of only the number of days" checked={deliveryDates.show} onChange={show => set("deliveryDates", { show })} hint="“Order today, get it between Tue, 2 Dec – Sat, 6 Dec.” Worked out from the delivery time above, skipping Sundays." />
      <label className="editor-field">Orders after this time count from the next day (India time)<select value={deliveryDates.cutoffHour} onChange={event => set("deliveryDates", { cutoffHour: Number(event.target.value) })}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label>
    </fieldset>
    <fieldset className="editor-group"><legend>Trust strip under the Buy buttons</legend>
      <Check label="Show the trust strip" checked={trustStrip.show} onChange={show => set("trustStrip", { show })} hint="Up to 4 promises with icons. Their titles also show above Checkout in the bag. Only promise what you always do." />
      {trustStrip.items.map((item, index) => <div className="editor-row" key={index}>
        <label className="editor-field">Icon<select value={item.icon} onChange={event => editTrust(index, { icon: event.target.value as TrustItem["icon"] })}>{TRUST_ICONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <TextField label={`Promise ${index + 1}`} value={item.title} max={40} onChange={title => editTrust(index, { title })} />
        <TextField label="Small line under it" value={item.text} max={60} onChange={text => editTrust(index, { text })} />
        <button className="text-button" type="button" onClick={() => set("trustStrip", { items: trustStrip.items.filter((_, i) => i !== index) })}>Remove</button>
      </div>)}
      <button className="secondary" type="button" disabled={trustStrip.items.length >= MAX_TRUST_ITEMS} onClick={() => set("trustStrip", { items: [...trustStrip.items, { icon: "secure", title: "", text: "" }] })}>+ Add promise</button>
    </fieldset>
    <fieldset className="editor-group"><legend>Photo before dispatch</legend>
      <Check label="Promise a photo of the murti before dispatch" checked={preDispatch.show} onChange={show => set("preDispatch", { show })} hint="Shown as a step on the order confirmed page. Remember to send the photo on WhatsApp for every order." />
      <TextField label="Text" value={preDispatch.text} max={300} rows={2} onChange={text => set("preDispatch", { text })} />
    </fieldset>
    <fieldset className="editor-group"><legend>Free gift with every order</legend>
      <Check label="Show a free gift in the bag and at checkout" checked={freeGift.show} onChange={show => set("freeGift", { show })} hint="A ₹0 line, e.g. “Free gift: Blessing card”. Pack it with every order." />
      <TextField label="Gift name" value={freeGift.name} max={80} placeholder="e.g. Blessing card" onChange={name => set("freeGift", { name })} hint={freeGift.show && !freeGift.name.trim() ? "Add the gift's name, or it won't show." : undefined} />
    </fieldset>
    <fieldset className="editor-group"><legend>WhatsApp and checkout</legend>
      <Check label="Round WhatsApp button on every page" checked={whatsappFloat.show} onChange={show => set("whatsappFloat", { show })} hint="Bottom right. On a product page the message names the murti." />
      <TextField label="Bubble next to it" value={whatsappFloat.label} max={60} onChange={label => set("whatsappFloat", { label })} hint="Shows after a few seconds; shoppers can close it. Leave empty for no bubble." />
      <Check label="Ask why, when someone leaves checkout" checked={leaveSurvey.show} onChange={show => set("leaveSurvey", { show })} hint="Once per visit. Answers are in Orders → Abandoned checkouts." />
    </fieldset>
    <fieldset className="editor-group"><legend>Stock and reviews</legend><Check label="Show “In stock”" hint="The green “In stock” above Add to bag. Low stock and out of stock messages always show." checked={inStock.show} onChange={show => set("inStock", { show })} /><Check label="Show how many are in stock" hint="Off: shoppers see only “In stock” or “Out of stock”, never the number left. The low stock message below shows only when this is on." checked={stockCount.show} onChange={show => set("stockCount", { show })} /><Check label="Google reviews section" hint="The same Google reviews as the home page, shown near the end of every product page." checked={googleReviews.show} onChange={show => set("googleReviews", { show })} /></fieldset>
    <fieldset className="editor-group"><legend>Low stock message</legend><label className="editor-field">Show when stock is at or below<input type="number" min={0} max={100} value={lowStock.threshold} onChange={event => set("lowStock", { threshold: Number(event.target.value) })} /></label><TextField label="Message" value={lowStock.text} max={80} onChange={text => set("lowStock", { text })} hint="{count} becomes the real number left." /></fieldset>
    <fieldset className="editor-group"><legend>Page extras</legend><Check label="Sticky Add to bag bar when scrolling" checked={stickyBar.show} onChange={show => set("stickyBar", { show })} /><Check label="Button at the end of the page" checked={endLink.show} onChange={show => set("endLink", { show })} /><TextField label="Button text" value={endLink.label} max={60} onChange={label => set("endLink", { label })} /><TextField label="Button link" value={endLink.link} max={300} onChange={link => set("endLink", { link })} /><Check label="WhatsApp help button" checked={whatsappHelp.show} onChange={show => set("whatsappHelp", { show })} /><TextField label="WhatsApp button text" value={whatsappHelp.label} max={80} onChange={label => set("whatsappHelp", { label })} /></fieldset>
    {saveBar}
  </>);
}
