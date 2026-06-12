/**
 * TypeScript types mirroring the Reply.BD storefront API responses.
 *
 * Source of truth: app/Http/Controllers/Api/V1/StorefrontController.php
 * (specifically the cached payloads from `show()`, `products()`, `product()`,
 * `categories()`, etc.)
 *
 * Keep these in sync whenever the Laravel API surface changes.
 */

// ──────────────────────────────────────────────────────────────
// Storefront metadata (GET /storefronts/{slug})
// ──────────────────────────────────────────────────────────────

export type StorefrontMeta = {
  slug: string;
  /**
   * 'ecommerce' renders the product storefront; 'service' renders the
   * block-based service website (service_home). Optional for backward
   * compatibility with cached API payloads that predate the field.
   */
  business_type?: 'ecommerce' | 'service';
  /**
   * Canonical site origin (custom domain when verified, else subdomain /
   * deployment URL). Used for <link rel="canonical">. Optional for cached
   * payloads that predate the field.
   */
  public_url?: string | null;
  name: string;
  /** Short phrase after the site title in the homepage <title>; description fallback. */
  tagline?: string | null;
  logo_url: string | null;
  /** Dedicated site icon; API falls back to the logo when unset. */
  favicon_url?: string | null;
  theme_color: string | null;
  /** Plain-text excerpt (footer + meta-description fallbacks). */
  about: string | null;
  /** Optional About-page H1; falls back to the store name. */
  about_title?: string | null;
  /** Full About article — sanitized HTML rendered from tenant Markdown. */
  about_html?: string | null;
  currency: string;
  whatsapp: string | null;
  email: string | null;
  location: string | null;
  footer_links: { label: string; url: string }[];
  /** Footer menu columns — API merges defaults, so headings/links are always set. */
  footer_nav?: {
    /** items = tenant-picked categories in picked order (or auto first 6), resolved server-side. */
    department: { visible: boolean; heading: string; items?: { label: string; url: string }[] };
    shop: { visible: boolean; heading: string; links: { label: string; url: string }[] };
  };
  social_links: Record<string, string> | object;
  messenger: { url: string | null; handle: string | null } | null;
  turnstile: { site_key: string | null };
  shipping: {
    enabled: boolean;
    free_shipping_threshold: number | null;
    zones: ShippingZone[];
  };
  seo: {
    title: string | null;
    description: string | null;
    og_image: string | null;
    /** WordPress-style "discourage search engines" (build/demo mode). */
    discourage?: boolean;
  };
  pixel: { id: string | null };
  /** Search-engine ownership codes (Google Search Console / Bing). */
  verification?: { google: string | null; bing: string | null };
  /** IndexNow key — served back at /indexnow-key.txt (public by design). */
  indexnow_key?: string | null;
  /**
   * Per-tenant homepage customization. Present (defaults merged) for
   * e-commerce tenants; NULL for service tenants, who get `service_home`.
   */
  homepage: HomepageConfig | null;
  /** Service-tenant website blocks. NULL for e-commerce tenants. */
  service_home?: ServiceHomeConfig | null;
};

// ──────────────────────────────────────────────────────────────
// Service-tenant website (ServiceSiteConfig::forApi)
// ──────────────────────────────────────────────────────────────

export type ServiceSectionKey =
  | 'hero' | 'about' | 'services' | 'portfolio'
  | 'stats' | 'testimonials' | 'faq' | 'contact';

/** Per-section background (same contract as funnel blocks / SectionBg). */
export type ServiceSectionBg = {
  bg_type?: 'none' | 'color' | 'gradient' | 'image';
  bg_color?: string;
  bg_gradient_from?: string;
  bg_gradient_to?: string;
  bg_gradient_angle?: number;
  bg_image_url?: string | null;
};

export type ServiceHomeConfig = {
  section_order: ServiceSectionKey[];
  /** Fade/slide blocks in on scroll (also triggers per-word data-anim). */
  animate?: boolean;
  hero: ServiceSectionBg & {
    visible: boolean;
    eyebrow: string;
    headline: string;
    subheadline: string;
    cta_label: string;
    image_url: string | null;
  };
  about: ServiceSectionBg & {
    visible: boolean;
    title: string;
    body: string;
    image_url: string | null;
    highlights: string[];
  };
  services: ServiceSectionBg & {
    visible: boolean;
    title: string;
    subtitle: string;
    items: { icon: string; title: string; body: string }[];
  };
  portfolio: ServiceSectionBg & {
    visible: boolean;
    title: string;
    subtitle: string;
    items: { image_url: string; caption: string }[];
  };
  stats: ServiceSectionBg & {
    visible: boolean;
    items: { number: string; label: string }[];
  };
  testimonials: ServiceSectionBg & {
    visible: boolean;
    title: string;
    items: { name: string; role: string; body: string; rating: number }[];
  };
  faq: ServiceSectionBg & {
    visible: boolean;
    title: string;
    items: { q: string; a: string }[];
  };
  contact: ServiceSectionBg & {
    visible: boolean;
    title: string;
    subtitle: string;
    button_label: string;
    success_message: string;
  };
};

/**
 * Per-tenant homepage customization. Visibility now lives inside each
 * section (was previously a separate `sections.*.visible` map). Each
 * product-displaying section has its own `product_ids` array — no auto
 * fallback to the default product list.
 */
export type HomepageConfig = {
  /** Render order. Sections not in this array render at the end. */
  section_order: HomepageSectionKey[];
  hero: {
    visible: boolean;
    eyebrow: string;
    headline: string;
    image_url: string | null;
    button1: { label: string; url: string };
    button2: { label: string; url: string };
    tiles: { image_url: string | null; url: string }[];
    product_ids: number[];
  };
  categories: {
    visible: boolean;
    title: string;
    category_ids: number[];
  };
  feature_products: {
    visible: boolean;
    title: string;
    subtitle: string;
    product_ids: number[];
  };
  promo_row: {
    visible: boolean;
    cards: { eyebrow: string; headline?: string; cta_label?: string; tone?: string; product_id: number | null }[];
  };
  trending_products: {
    visible: boolean;
    title: string;
    subtitle: string;
    product_ids: number[];
  };
  brand_strip: {
    visible: boolean;
    items: { name: string; badge: string; detail: string; tone: string }[];
  };
  promo_banner: {
    visible: boolean;
    eyebrow: string;
    headline: string;
    subtitle: string;
    discount: number;
    button_text: string;
    button_url: string;
    gradient: 'purple' | 'rose' | 'emerald' | 'amber' | 'sky' | 'slate';
  };
  most_selling: {
    visible: boolean;
    title: string;
    subtitle: string;
    product_ids: number[];
  };
  card_payment_promo: {
    visible: boolean;
    headline: string;
    body: string;
    button_text: string;
    button_url: string;
  };
  deals_of_day: {
    visible: boolean;
    title: string;
    spotlight_id: number | null;
    product_ids: number[];
  };
  services_row: {
    visible: boolean;
    items: { icon: string; tone: string; title: string; body: string }[];
  };
  trust_badges: {
    visible: boolean;
    items: { icon: string; title: string; body: string }[];
  };
};

export type HomepageSectionKey =
  | 'hero' | 'categories' | 'feature_products' | 'promo_row'
  | 'trending_products' | 'brand_strip' | 'promo_banner'
  | 'most_selling' | 'card_payment_promo' | 'deals_of_day'
  | 'services_row' | 'trust_badges';

export type ShippingZone = {
  code: 'inside_city' | 'outside_city' | string;
  label: string;
  fee: number;
};

// ──────────────────────────────────────────────────────────────
// Products (GET /products, /products/{slug})
// ──────────────────────────────────────────────────────────────

export type ProductCard = {
  id: number;
  slug: string;
  name: string;
  short_description?: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  image_url: string | null;
  stock_badge?: string | null;
  has_variants?: boolean;
  in_stock: boolean;
  // Optional — most callers should read ratings from ProductDetail.reviews
  // instead. Card endpoints don't currently return these.
  rating_avg?: number | null;
  rating_count?: number;
  categories?: { slug: string; name: string }[];
};

export type ProductDetail = ProductCard & {
  brand: string | null;
  warranty: string | null;
  video_url: string | null;
  /** Raw Markdown (kept for fallbacks). */
  support_info: string | null;
  description: string | null;
  /** Server-rendered, sanitized HTML from the Markdown source. */
  specifications_html: string | null;
  support_info_html: string | null;
  description_html: string | null;
  currency: string;
  /** Product's own photos (shown in the buy-box gallery). */
  gallery_urls: string[];
  /** Customer / lifestyle photos (shown in the Galleries tab). */
  customer_gallery_urls: string[];
  variants: ProductVariant[];
  reviews: { count: number; average: number | null; items: ProductReview[] };
  related_products: ProductCard[];
  funnel: FunnelPayload | null;
  messenger_deep_link: string | null;
  categories: { slug: string; name: string }[];
  seo: {
    title: string | null;
    description: string | null;
    og_image: string | null;
    /** Per-product "Hide from search results" — render robots noindex. */
    noindex?: boolean;
  };
};

// Matches the storefront API's variant shape exactly (StorefrontController::
// variants()). The API keys each variant by its array `index` (used as the
// stable identity AND submitted as `variant_index` when ordering) and a
// composed `label` ("Red / XL"); there is no `id` / `name`.
export type ProductVariant = {
  index: number;
  label: string;
  color: string | null;
  size: string | null;
  weight: string | null;
  price: number | null;
  compare_at_price: number | null;
  stock: number | null;
  in_stock: boolean;
  image_url: string | null;
};

// Matches StorefrontController::reviewPayload() exactly — the previous
// shape (`author`, `title`) never existed on the API and left review
// author names rendering blank on the PDP.
export type ProductReview = {
  id: number;
  author_name: string;
  location: string | null;
  avatar_url: string | null;
  rating: number;
  body: string;
  images: string[];
  is_featured: boolean;
  created_at: string;
};

/**
 * Long-form landing page payload — present on products configured for the
 * funnel layout. When non-null the PDP renders a single-column landing
 * (hero + benefits + FAQ + sticky CTA) instead of the standard two-column
 * gallery + buy-box layout.
 */
export type FunnelPayload = {
  headline: string | null;
  subheadline: string | null;
  /** Key selling points. The API normalises to {icon, title}; legacy cached
   *  payloads may still contain plain strings. */
  benefits: ({ icon?: string; title: string } | string)[];
  faq: { q: string; a: string }[];
};

// ──────────────────────────────────────────────────────────────
// Funnels (GET /storefronts/{slug}/funnels/{funnelSlug})
// ──────────────────────────────────────────────────────────────

export type FunnelReview = {
  id: number;
  author_name: string;
  location: string | null;
  avatar_url: string | null;
  rating: number;
  body: string;
  images: string[];
  is_featured: boolean;
  created_at: string | null;
};

export type FunnelProduct = {
  id: number;
  slug: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  currency: string;
  image_url: string | null;
  gallery_urls: string[];
  variants: ProductVariant[];
  in_stock: boolean;
  stock_badge?: string | null;
  reviews: { count: number; average: number | null; items: FunnelReview[] };
};

export type FunnelBlockConfig = {
  section_order: string[];
  animate?: boolean;
  hero: {
    visible: boolean;
    eyebrow: string;
    headline: string;
    headline_style?: 'plain' | 'gradient' | 'highlight';
    subheadline: string;
    image_url: string | null;
    cta_label: string;
    // Full-section background (one mode at a time)
    bg_type?: 'none' | 'color' | 'gradient' | 'image';
    bg_color?: string;
    bg_gradient_from?: string;
    bg_gradient_to?: string;
    bg_gradient_angle?: number;
    bg_image_url?: string | null;
  };
  benefits: { visible: boolean; title: string; items: string[] };
  gallery: { visible: boolean; image_urls: string[] };
  price: { visible: boolean; note: string };
  urgency: { visible: boolean; headline: string; stock_text: string; countdown_minutes: number };
  order_form: { visible: boolean; heading: string; button_label: string };
  why_us: { visible: boolean; title: string; items: { title: string; body: string }[] };
  reviews: { visible: boolean; title: string };
  faq: { visible: boolean; items: { q: string; a: string }[] };
  trust_badges: { visible: boolean; items: { icon: string; title: string }[] };
};

export type FunnelData = {
  slug: string;
  name: string;
  goal: string;
  config: FunnelBlockConfig;
  product: FunnelProduct;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

// ──────────────────────────────────────────────────────────────
// Categories
// ──────────────────────────────────────────────────────────────

export type Category = {
  id: number;
  slug: string;
  name: string;
  product_count: number;
  /** Present on the category DETAIL payload (flat on data). */
  noindex?: boolean;
};

// ──────────────────────────────────────────────────────────────
// Orders (POST /orders, GET /orders/{number})
// ──────────────────────────────────────────────────────────────

export type CreateOrderInput = {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  address: string;
  customer_city?: string | null;
  shipping_zone?: string;       // 'inside_city' | 'outside_city'
  notes?: string;
  product_id: number;
  variant_index?: number | null;
  quantity: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  funnel_url?: string;
  // Cloudflare Turnstile token from the widget
  cf_turnstile_response?: string;
};

export type OrderResponse = {
  order_number: string;
  status: string;            // 'pending' | 'on_hold' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  status_label?: string;
  subtotal: number;
  shipping_fee: number;
  total: number;
  currency: string;
  // From POST /orders:
  message?: string;
  duplicate?: boolean;
  // From GET /orders/{number}:
  placed_at?: string;
  customer_name?: string;
  address?: string;
  shipping_zone?: string | null;
  items?: {
    product_name: string;
    variant: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
};
