// Same shapes as kalacar-app/src/data/site-content.ts. The server checks everything it receives.
export type HeroSlide = { productId: string; backgroundImage: string; desktopImage: string; showEyebrow: boolean; eyebrow: string; showTitle: boolean; title: string; showDescription: boolean; description: string; buy: { show: boolean; label: string; showPrice: boolean }; explore: { show: boolean; label: string; link: string } };
export const MAX_HERO_SLIDES = 8;
export const NEW_HERO_SLIDE: HeroSlide = { productId: "", backgroundImage: "", desktopImage: "", showEyebrow: true, eyebrow: "", showTitle: true, title: "", showDescription: true, description: "", buy: { show: true, label: "Buy now", showPrice: true }, explore: { show: true, label: "Explore collections", link: "#catalogue" } };
export type SpotlightSection = { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string; productId: string; image: string; showLogo: boolean; whatsapp: { show: boolean; label: string } };
export const DEFAULT_GOOGLE_REVIEWS_HEAD: HomeContent["googleReviews"] = { show: true, showEyebrow: true, eyebrow: "Google reviews", showTitle: true, title: "Loved by devotees", showDescription: true, description: "Real Google reviews of Murtiverse, our sister studio. Same hands, same care." };
export const DEFAULT_SPOTLIGHT: SpotlightSection = { show: false, showTitle: true, title: "Bring home the divine", showDescription: true, description: "", productId: "", image: "", showLogo: true, whatsapp: { show: true, label: "Order on WhatsApp" } };
export type CatalogueSection = { show: boolean; showEyebrow: boolean; eyebrow: string; showTitle: boolean; title: string; showDescription: boolean; description: string; productIds: string[]; showFilters: boolean };
export const DEFAULT_CATALOGUE: CatalogueSection = { show: true, showEyebrow: true, eyebrow: "FEATURED", showTitle: true, title: "Murtis for everyday spaces", showDescription: false, description: "", productIds: [], showFilters: false };
export type HomeContent = {
  hero: { show: boolean; autoplay: boolean; interval: number; slides: HeroSlide[] };
  firstLaunch: { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string; productIds: string[] };
  comingSoon: { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string; items: { name: string; image: string }[] };
  collections: { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string };
  catalogue: CatalogueSection;
  why: { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string; items: { title: string; text: string; icon?: string }[]; showLogo: boolean; logo: string };
  /** Heading above the fixed Google reviews of Murtiverse. */
  googleReviews: { show: boolean; showEyebrow: boolean; eyebrow: string; showTitle: boolean; title: string; showDescription: boolean; description: string };
  reviews: { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string; showText: boolean; showVideo: boolean };
  spotlight: SpotlightSection;
  story: { show: boolean; showTitle: boolean; title: string; showText: boolean; text: string; showImage: boolean; image: string; showFounder: boolean; founder: string };
};
export type ProductPageContent = {
  offer: { show: boolean; title: string; text: string };
  howMade: { show: boolean; title: string; message: string; showImage: boolean; image: string; founder: string };
  faqs: { show: boolean; title: string; items: { question: string; answer: string }[] };
  viewers: { show: boolean; minimum: number };
  recentSales: { show: boolean; showFirstName: boolean; showImage: boolean; everyPage: boolean; delay: number; duration: number; size: "small" | "medium" | "large" };
  soldThisWeek: { show: boolean; minimum: number; hours: number };
  lowStock: { threshold: number; text: string };
  stickyBar: { show: boolean };
  endLink: { show: boolean; label: string; link: string };
  whatsappHelp: { show: boolean; label: string };
  eyebrow: { show: boolean; text: string };
  stockCount: { show: boolean };
  googleReviews: { show: boolean };
};
export const DEFAULT_EYEBROW = { show: true, text: "{category} · SMALL DEVOTIONAL MURTI" };
/** Same as the shop: the number in stock is hidden until turned on; Google reviews show. */
export const DEFAULT_STOCK_COUNT = { show: false };
export const DEFAULT_GOOGLE_REVIEWS = { show: true };
/** Suggested "Why choose" text, matching the shop's built-in text. */
export const SUGGESTED_WHY = {
  description: "Small murtis made with devotion, checked and packed by us, and sent safely to your home.",
  items: [
    { title: "Made for small spaces", text: "Sized for car dashboards, Devghars and work desks, so Bhagwan stays with you wherever you go." },
    { title: "Crafted with care", text: "Made by the same hands as our sister studio Murtiverse, with fine detail on every face and ornament." },
    { title: "Checked before it ships", text: "We look over every murti ourselves before it leaves us, so it reaches you just as it should." },
    { title: "Packed for a safe journey", text: "Wrapped and boxed with care so your murti arrives safely at your door." },
  ],
};
export type ProductOption = { id: string; name: string };
export const DEFAULT_ACTIVITY: Pick<ProductPageContent, "viewers" | "recentSales" | "soldThisWeek"> = {
  viewers: { show: false, minimum: 2 },
  recentSales: { show: false, showFirstName: false, showImage: true, everyPage: false, delay: 8, duration: 8, size: "medium" },
  soldThisWeek: { show: false, minimum: 3, hours: 168 },
};
