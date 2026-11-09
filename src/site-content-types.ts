// Same shapes as kalacar-app/src/data/site-content.ts. The server checks everything it receives.
export type HeroSlide = { productId: string; backgroundImage: string; desktopImage: string; showEyebrow: boolean; eyebrow: string; showTitle: boolean; title: string; showDescription: boolean; description: string; buy: { show: boolean; label: string; showPrice: boolean }; explore: { show: boolean; label: string; link: string } };
export const MAX_HERO_SLIDES = 8;
export const NEW_HERO_SLIDE: HeroSlide = { productId: "", backgroundImage: "", desktopImage: "", showEyebrow: true, eyebrow: "", showTitle: true, title: "", showDescription: true, description: "", buy: { show: true, label: "Buy now", showPrice: true }, explore: { show: true, label: "Explore collections", link: "#catalogue" } };
export type SpotlightSection = { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string; productId: string; image: string; showLogo: boolean; whatsapp: { show: boolean; label: string } };
export const DEFAULT_SPOTLIGHT: SpotlightSection = { show: false, showTitle: true, title: "Bring home the divine", showDescription: true, description: "", productId: "", image: "", showLogo: true, whatsapp: { show: true, label: "Order on WhatsApp" } };
export type HomeContent = {
  hero: { show: boolean; autoplay: boolean; interval: number; slides: HeroSlide[] };
  firstLaunch: { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string; productIds: string[] };
  comingSoon: { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string; items: { name: string; image: string }[] };
  collections: { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string };
  why: { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string; items: { title: string; text: string }[] };
  reviews: { show: boolean; showTitle: boolean; title: string; showDescription: boolean; description: string; showText: boolean; showVideo: boolean };
  spotlight: SpotlightSection;
  story: { show: boolean; showTitle: boolean; title: string; showText: boolean; text: string; showImage: boolean; image: string; showFounder: boolean; founder: string };
};
export type ProductPageContent = {
  offer: { show: boolean; title: string; text: string };
  howMade: { show: boolean; title: string; message: string; showImage: boolean; image: string; founder: string };
  faqs: { show: boolean; title: string; items: { question: string; answer: string }[] };
  viewers: { show: boolean; minimum: number };
  recentSales: { show: boolean; showFirstName: boolean };
  soldThisWeek: { show: boolean; minimum: number };
  lowStock: { threshold: number; text: string };
  stickyBar: { show: boolean };
  endLink: { show: boolean; label: string; link: string };
  whatsappHelp: { show: boolean; label: string };
};
export type ProductOption = { id: string; name: string };
