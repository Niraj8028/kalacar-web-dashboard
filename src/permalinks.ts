/** Same rule as the shop: "Shree Krushna" → "shree-krushna". */
export function slugify(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
}
