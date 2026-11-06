import { useEffect, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { Check, SaveBar, TextField } from "./editor-fields";
import { HomeEditor } from "./home-editor";
import { RichText } from "./rich-text";
import type { ProductOption } from "./site-content-types";

type SitePage = { slug: string; title: string; intro: string; content: string; seoTitle: string; seoDescription: string; published: boolean; inFooter: boolean; hasForm: boolean; draft: boolean };

function PageEditor({ page, onSaved, shopLink }: { page: SitePage; onSaved: (page: SitePage) => void; shopLink: string }) {
  const [draft, setDraft] = useState(page);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify({ ...draft, draft: 0 }) !== JSON.stringify({ ...page, draft: 0 });
  const edit = (change: Partial<SitePage>) => { setDraft(current => ({ ...current, ...change })); setMessage(""); };
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try { const data = await sendJson<{ page: SitePage }>(`/api/admin/pages/${page.slug}`, "PATCH", draft); setDraft(data.page); onSaved(data.page); setMessage("Saved. The page is updated."); }
    catch (cause) { setError(errorText(cause, "Could not save the page.")); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (!window.confirm("Go back to this page's starting text? Your edits to it will be lost.")) return;
    setBusy(true); setError(""); setMessage("");
    try { const data = await sendJson<{ page: SitePage }>(`/api/admin/pages/${page.slug}`, "DELETE"); setDraft(data.page); onSaved(data.page); setMessage("Starting text restored."); }
    catch (cause) { setError(errorText(cause, "Could not reset the page.")); }
    finally { setBusy(false); }
  }
  const address = `${shopLink.replace(/\/$/, "")}/${page.slug}`;
  return <section className="panel settings-card" aria-label={`Edit ${page.title}`}>
    <div className="panel-head"><div><p className="overline">PAGE</p><h2>{page.title}</h2>{shopLink && <a className="text-button" href={address} target="_blank" rel="noopener noreferrer">View page</a>}</div></div>
    {page.draft && <p className="owner-orders-note" role="note">This page has "To confirm" items, so it shows a draft notice and stays out of Google. Replace the highlighted text and remove the highlight to finish it.</p>}
    {page.hasForm && <p className="muted">The contact form always appears below this text. Messages arrive in Inquiries.</p>}
    <TextField label="Page title" value={draft.title} max={120} onChange={title => edit({ title })} />
    <TextField label="Short intro" value={draft.intro} max={300} rows={2} onChange={intro => edit({ intro })} />
    <div className="editor-field"><span>Page content</span><RichText label={`${page.title} content`} value={draft.content} onChange={content => edit({ content })} /></div>
    <Check label="Page is live" checked={draft.published} onChange={published => edit({ published })} hint="Turned off, the page can't be opened." />
    <Check label="Show in the footer" checked={draft.inFooter} onChange={inFooter => edit({ inFooter })} />
    <TextField label="SEO title (for Google)" value={draft.seoTitle} max={70} placeholder={`${draft.title} — Kalacar`} onChange={seoTitle => edit({ seoTitle })} hint={`${draft.seoTitle.length}/70. Leave empty to use the page title.`} />
    <TextField label="Meta description (for Google)" value={draft.seoDescription} max={170} rows={2} onChange={seoDescription => edit({ seoDescription })} hint={`${draft.seoDescription.length}/170`} />
    <SaveBar dirty={dirty} busy={busy} message={message} error={error} onUndo={() => { setDraft(page); setMessage(""); setError(""); }} onSave={() => void save()} label="Save page" />
    <button className="text-button" type="button" disabled={busy} onClick={() => void reset()}>Go back to starting text</button>
  </section>;
}

export function PagesSection({ products, shopLink }: { products: ProductOption[]; shopLink: string }) {
  const [pages, setPages] = useState<SitePage[] | null>(null);
  const [active, setActive] = useState("home");
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    getJson<{ pages: SitePage[] }>("/api/admin/pages", "Pages are unavailable right now.").then(data => { if (current) setPages(data.pages); }).catch(cause => { if (current) setError(errorText(cause, "Pages are unavailable right now.")); });
    return () => { current = false; };
  }, []);
  const page = pages?.find(item => item.slug === active);
  return <>
    <div className="page-heading"><div><p className="overline">WEBSITE</p><h1>Pages</h1><p className="muted">Change your home page and information pages here, with no code needed.</p></div></div>
    <section className="panel order-filters" role="group" aria-label="Choose a page">
      <button type="button" className={active === "home" ? "order-filter selected" : "order-filter"} aria-pressed={active === "home"} onClick={() => setActive("home")}>Home Page</button>
      {pages?.map(item => <button type="button" key={item.slug} className={active === item.slug ? "order-filter selected" : "order-filter"} aria-pressed={active === item.slug} onClick={() => setActive(item.slug)}>{item.title}{item.draft && <span title="Has items to confirm">Draft</span>}</button>)}
    </section>
    {error && active !== "home" && <p className="order-detail-error" role="alert">{error}</p>}
    {active === "home" ? <HomeEditor products={products} /> : page && <PageEditor key={page.slug} page={page} shopLink={shopLink} onSaved={saved => setPages(current => current?.map(item => item.slug === saved.slug ? saved : item) ?? null)} />}
  </>;
}
