import { useEffect, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { Check, TextField } from "./editor-fields";
import { StatusChip } from "./dashboard-ui";

type FooterLink = { label: string; link: string };
type Footer = { text: string; showWhatsapp: boolean; links: FooterLink[] | null };
type Page = { slug: string; title: string; published: boolean; inFooter: boolean };
const MAX_LINKS = 16;
const DEFAULT: Footer = { text: "Prices and availability reflect the current catalogue.", showWhatsapp: true, links: null };

/**
 * The footer on every shop page, and the links under "Information" in the phone menu.
 * Until a list is saved, links follow Pages → "Show in the footer"; editing here starts from that list.
 */
export function FooterPanel() {
  const [saved, setSaved] = useState<Footer | null>(null);
  const [draft, setDraft] = useState<Footer>(DEFAULT);
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      getJson<{ footer?: Partial<Footer> }>("/api/admin/settings", "Settings are unavailable right now."),
      getJson<{ pages: Page[] }>("/api/admin/pages", "Pages are unavailable right now.").catch(() => ({ pages: [] as Page[] })),
    ]).then(([settings, list]) => {
      if (!active) return;
      const footer = { ...DEFAULT, ...settings.footer };
      setSaved(footer); setDraft(footer); setPages(list.pages);
    }).catch(cause => { if (active) setError(errorText(cause, "Settings are unavailable right now.")); });
    return () => { active = false; };
  }, []);
  const automatic = pages.filter(page => page.published && page.inFooter).map(page => ({ label: page.title, link: `/${page.slug}` }));
  const links = draft.links ?? automatic;
  const change = (next: Partial<Footer>) => { setDraft(current => ({ ...current, ...next })); setError(""); setMessage(""); };
  const setLinks = (next: FooterLink[]) => change({ links: next });
  const editLink = (index: number, next: Partial<FooterLink>) => setLinks(links.map((item, i) => i === index ? { ...item, ...next } : item));
  const move = (index: number, by: number) => { const next = [...links]; const [item] = next.splice(index, 1); next.splice(index + by, 0, item); setLinks(next); };
  const dirty = saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const body = { ...draft, links: draft.links?.map(item => ({ label: item.label.trim(), link: item.link.trim() })) ?? null };
      const data = await sendJson<{ footer: Footer }>("/api/admin/settings", "PATCH", { footer: body });
      setSaved(data.footer); setDraft(data.footer);
      const dropped = (body.links?.length ?? 0) - (data.footer.links?.length ?? 0);
      setMessage(dropped > 0 ? `Saved. ${dropped} link${dropped === 1 ? " was" : "s were"} left out: each needs a name and a page like /about or an https:// address.` : "Saved. The footer and menu are updated on every page.");
    } catch (cause) { setError(errorText(cause, "Could not save the footer.")); }
    finally { setBusy(false); }
  }
  return <section className={`panel settings-card${dirty ? " dirty" : ""}`} aria-labelledby="footer-title">
    <div className="panel-head"><div><p className="overline">EVERY PAGE</p><h2 id="footer-title">Footer and menus</h2></div>{saved && <StatusChip tone="neutral">{saved.links ? `${saved.links.length} links` : "Automatic links"}</StatusChip>}</div>
    <p className="muted">The dark footer at the bottom of every page. The same links show under “Information” in the phone menu. Categories in the menu come from your products.</p>
    {saved === null ? !error && <p className="muted">Loading…</p> : <>
      <fieldset className="editor-group"><legend>Footer text</legend>
        <TextField label="Text next to the logo" value={draft.text} max={300} rows={2} onChange={text => change({ text })} hint="Leave empty to hide it." />
        <Check label="Show the WhatsApp number" checked={draft.showWhatsapp} onChange={showWhatsapp => change({ showWhatsapp })} />
      </fieldset>
      <fieldset className="editor-group"><legend>Links</legend>
        {draft.links === null && <p className="muted">Now showing the pages that have “Show in the footer” ticked in Pages. Change anything below to choose the links yourself.</p>}
        {links.map((item, index) => <div className="editor-row footer-link-row" key={index}>
          <TextField label="Name" value={item.label} max={60} onChange={label => editLink(index, { label })} />
          <label className="editor-field">Opens<select value={pages.some(page => `/${page.slug}` === item.link) ? item.link : "other"} onChange={event => editLink(index, event.target.value === "other" ? { link: "" } : { link: event.target.value, label: item.label || (pages.find(page => `/${page.slug}` === event.target.value)?.title ?? "") })}>
            {pages.map(page => <option key={page.slug} value={`/${page.slug}`}>{page.title}{page.published ? "" : " (hidden page)"}</option>)}
            <option value="other">Another link…</option>
          </select></label>
          {!pages.some(page => `/${page.slug}` === item.link) && <TextField label="Link" value={item.link} max={300} placeholder="/account or https://instagram.com/…" onChange={link => editLink(index, { link })} />}
          <div className="footer-link-actions">
            <button className="text-button" type="button" aria-label={`Move ${item.label || "link"} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑ Up</button>
            <button className="text-button" type="button" aria-label={`Move ${item.label || "link"} down`} disabled={index === links.length - 1} onClick={() => move(index, 1)}>↓ Down</button>
            <button className="text-button" type="button" onClick={() => setLinks(links.filter((_, i) => i !== index))}>Remove</button>
          </div>
        </div>)}
        <button className="secondary" type="button" disabled={links.length >= MAX_LINKS} onClick={() => setLinks([...links, { label: "", link: "" }])}>+ Add link</button>
        {draft.links !== null && <button className="text-button" type="button" onClick={() => change({ links: null })}>Go back to automatic links</button>}
      </fieldset>
    </>}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {message && <p className="order-saved" role="status">{message}</p>}
    {saved !== null && <div className="settings-actions">{dirty && <span className="stock-change-summary">Unsaved changes</span>}<button className="text-button" type="button" disabled={!dirty || busy} onClick={() => setDraft(saved)}>Undo</button><button className="primary" type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save footer"}</button></div>}
  </section>;
}
