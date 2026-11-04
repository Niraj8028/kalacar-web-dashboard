// Inline SVG icons for the owner dashboard (no emoji or symbol glyphs). Decorative by default.
import type { ReactNode } from "react";
type IconProps = { size?: number; className?: string };
const Svg = ({ size = 18, className, children }: IconProps & { children: ReactNode }) => <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;

export const HomeIcon = (p: IconProps) => <Svg {...p}><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" /></Svg>;
export const OrdersIcon = (p: IconProps) => <Svg {...p}><path d="M6 4h12v16l-3-2-3 2-3-2-3 2z M9 9h6M9 13h6" /></Svg>;
export const ProductIcon = (p: IconProps) => <Svg {...p}><path d="M12 3c2 2.5 3 4.5 3 6.5a3 3 0 0 1-6 0C9 7.5 10 5.5 12 3Z M7 20h10M9 20c0-3 1-5.5 3-5.5s3 2.5 3 5.5" /></Svg>;
export const CustomersIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></Svg>;
export const CouponIcon = (p: IconProps) => <Svg {...p}><path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z M9.5 14.5l5-5M10 10h.01M14 14h.01" /></Svg>;
export const SettingsIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" /></Svg>;
export const SignOutIcon = (p: IconProps) => <Svg {...p}><path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h9" /></Svg>;
export const SearchIcon = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Svg>;
export const ChevronDown = (p: IconProps) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const ArrowRight = (p: IconProps) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const EnterIcon = (p: IconProps) => <Svg {...p}><path d="M19 5v7a3 3 0 0 1-3 3H6M10 11l-4 4 4 4" /></Svg>;
export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const AlertIcon = (p: IconProps) => <Svg {...p}><path d="M12 8v5M12 16.5h.01M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" /></Svg>;
export const RupeeIcon = (p: IconProps) => <Svg {...p}><path d="M7 5h10M7 9h10M10 5c3.3 0 5 1.6 5 4s-1.7 4-5 4H7l7 6" /></Svg>;
export const TrendIcon = (p: IconProps) => <Svg {...p}><path d="M4 16l5-5 4 4 7-7M15 8h5v5" /></Svg>;
export const PackageIcon = (p: IconProps) => <Svg {...p}><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z M4 8.5 12 13l8-4.5M12 13v7" /></Svg>;

export const sectionIcons = { Overview: HomeIcon, Orders: OrdersIcon, Products: ProductIcon, Customers: CustomersIcon, Coupons: CouponIcon, Settings: SettingsIcon } as const;
