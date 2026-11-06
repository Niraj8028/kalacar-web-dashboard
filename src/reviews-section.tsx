import { useEffect, useState } from "react";
import { errorText, getJson, sendJson } from "./admin-api";
import { StatusChip } from "./dashboard-ui";
import { Check, ImageField, TextField } from "./editor-fields";
import { useLiveRevision } from "./realtime";
import type { ProductOption } from "./site-content-types";

type Review = { id: number; productId: string | null; author: string; city: string; rating: number; text: string; photos: string[]; videoUrl: string; showOnHome: boolean; published: boolean };
type Draft = Omit<Review, "id"> & { id?: number };
const BLANK: Draft = { productId: null, author: "", city: "", rating: 5, text: "", photos: [], videoUrl: "", showOnHome: false, published: true };

function ReviewForm({ review, products, onDone, onCancel }: { review: Draft; products: ProductOption[]; onDone: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(review);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const edit = (change: Partial<Draft>) => setDraft(current => ({ ...current, ...change }));
  async function save() {
    setBusy(true); setError("");
    try { await sendJson(review.id ? `/api/admin/reviews/${review.id}` : "/api/admin/reviews", review.id ? "PATCH" : "POST", draft); onDone(); }
    catch (cause) { setError(errorText(cause, "Could not save the review.")); setBusy(false); }
  }
  return <section className="panel settings-card" aria-label={review.id ? "Edit review" : "Add review"}>
    <h2>{review.id ? "Edit review" : "Add a review"}</h2>
    <p className="muted">Add only reviews from real customers. Stars and review counts on the shop are worked out from these.</p>
    <label className="editor-field">Product<select value={draft.productId ?? ""} onChange={event => edit({ productId: event.target.value || null })}><option value="">Shop in general (no product)</option>{products.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
    <TextField label="Customer name" value={draft.author} max={80} onChange={author => edit({ author })} />
    <TextField label="City (optional)" value={draft.city} max={80} onChange={city => edit({ city })} />
    <label className="editor-field">Rating<select value={draft.rating} onChange={event => edit({ rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} {n === 1 ? "star" : "stars"}</option>)}</select></label>
    <TextField label="Review" value={draft.text} max={1500} rows={4} onChange={text => edit({ text })} />
    <TextField label="Video link (optional)" value={draft.videoUrl} max={300} placeholder="YouTube or Instagram link" onChange={videoUrl => edit({ videoUrl })} />
    <div className="editor-image-grid">
      {draft.photos.map((photo, index) => <ImageField key={photo} label={`Photo ${index + 1}`} value={photo} onChange={url => edit({ photos: url ? draft.photos.map((other, i) => i === index ? url : other) : draft.photos.filter((_, i) => i !== index) })} />)}
      {draft.photos.length < 6 && <ImageField label="Add a customer photo" value="" onChange={url => { if (url) edit({ photos: [...draft.photos, url] }); }} />}
    </div>
    <Check label="Show on home page" checked={draft.showOnHome} onChange={showOnHome => edit({ showOnHome })} />
    <Check label="Published" checked={draft.published} onChange={published => edit({ published })} />
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    <div className="settings-actions"><button className="text-button" type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save review"}</button></div>
  </section>;
}

export function ReviewsSection({ products }: { products: ProductOption[] }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const revision = useLiveRevision(true, "store");
  useEffect(() => {
    let active = true;
    getJson<{ reviews: Review[] }>("/api/admin/reviews", "Reviews are unavailable right now.").then(data => { if (active) { setReviews(data.reviews); setError(""); } }).catch(cause => { if (active) setError(errorText(cause, "Reviews are unavailable right now.")); });
    return () => { active = false; };
  }, [revision]);
  async function remove(id: number) {
    if (!window.confirm("Delete this review?")) return;
    try { await sendJson(`/api/admin/reviews/${id}`, "DELETE"); setReviews(current => current?.filter(review => review.id !== id) ?? null); }
    catch (cause) { setError(errorText(cause, "Could not delete the review.")); }
  }
  const nameOf = (id: string | null) => id ? products.find(option => option.id === id)?.name ?? id : "Shop in general";
  return <>
    <div className="page-heading"><div><p className="overline">CUSTOMERS</p><h1>Reviews</h1><p className="muted">Real customer reviews, photos and videos for your product and home pages.</p></div><div className="heading-actions"><button className="secondary" type="button" onClick={() => setEditing({ ...BLANK })}>+ Add review</button></div></div>
    {editing && <ReviewForm key={editing.id ?? "new"} review={editing} products={products} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); void getJson<{ reviews: Review[] }>("/api/admin/reviews", "").then(data => setReviews(data.reviews)).catch(() => undefined); }} />}
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    <section className="panel editor-list">{!reviews ? !error && <p className="empty-orders">Loading reviews…</p> : !reviews.length ? <p className="empty-orders">No reviews yet.</p> : reviews.map(review => <article className="editor-list-row" key={review.id}>
      <div><b>{review.author}{review.city && `, ${review.city}`}</b><small>{nameOf(review.productId)} · {review.rating} {review.rating === 1 ? "star" : "stars"}{review.videoUrl && " · video"}{review.photos.length > 0 && ` · ${review.photos.length} ${review.photos.length === 1 ? "photo" : "photos"}`}</small>{review.text && <p>{review.text}</p>}</div>
      <div className="editor-list-actions">{!review.published && <StatusChip>Hidden</StatusChip>}{review.showOnHome && <StatusChip tone="success">Home page</StatusChip>}<button className="secondary" type="button" onClick={() => setEditing(review)}>Edit</button><button className="text-button" type="button" onClick={() => void remove(review.id)}>Delete</button></div>
    </article>)}</section>
  </>;
}
