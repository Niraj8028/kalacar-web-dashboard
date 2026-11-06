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
export async function uploadImage(file: File) {
  const form = new FormData();
  form.set("image", file);
  const response = await fetch("/api/admin/uploads", { method: "POST", body: form });
  const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error || "Could not save the photo.");
  return data.url;
}
