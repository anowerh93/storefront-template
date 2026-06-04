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
  name: string;
  logo_url: string | null;
  theme_color: string | null;
  about: string | null;
  currency: string;
  whatsapp: string | null;
  email: string | null;
  location: string | null;
  footer_links: { label: string; url: string }[];
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
  };
  pixel: { id: string | null };
  /**
   * Per-tenant homepage customization. Always present (Laravel merges
   * defaults from HomepageConfig::default()), so the template can render
   * sections without null-checking the top-level field.
   */
  homepage: HomepageConfig;
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
    tiles: { image_url: string | null; heading: string; subtext: string; url: string }[];
    product_ids: number[];
  };
  categories: {
    visible: boolean;
    title: string;
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
  description: string | null;
  currency: string;
  gallery_urls: string[];
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

export type ProductReview = {
  id: number;
  author: string;
  rating: number;
  title: string | null;
  body: string;
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
  benefits: { title: string; body: string }[];
  faq: { q: string; a: string }[];
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
  slug: string;
  name: string;
  product_count: number;
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
