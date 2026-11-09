// Small helpers for dashboard screens that load and save JSON.
export async function getJson<T>(url: string, fallback: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}
export async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "That didn't save. Please try again.");
  return data;
}
export const errorText = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : fallback;
const MAX_SIDE = 2400, MAX_BYTES = 1.5 * 1024 * 1024;
/** Phone photos are often 5–15 MB; resize to 2400px and re-encode so uploads stay small and fast. */
export async function shrinkImage(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { return file; }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_BYTES) { bitmap.close(); return file; }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 0.85));
  let blob = await encode("image/webp");
  if (blob && blob.type !== "image/webp") blob = await encode("image/jpeg"); // Safari can't make WebP
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type });
}
export async function uploadImage(original: File) {
  const file = await shrinkImage(original);
  const form = new FormData();
  form.set("image", file);
  const response = await fetch("/api/admin/uploads", { method: "POST", body: form });
  const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error || "Could not save the photo.");
  return data.url;
}
