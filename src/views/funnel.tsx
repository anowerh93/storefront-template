import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode, type CSSProperties } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ShoppingBag, Truck, Minus, Plus, Check, Clock,
  ShieldCheck, RefreshCw, Headphones, Package, CreditCard, Gift,
  Award, Phone, Heart, Sparkles, BadgeCheck, ThumbsUp,
  ChevronLeft, ChevronRight,
  Leaf, Zap, Brain, Flame, Droplet, Smile, Activity,
  Globe, MessageCircle, HelpCircle,
} from 'lucide-react';
import type { FunnelData, FunnelBlockConfig, FunnelProduct, StorefrontMeta } from '../lib/types';
import { submitOrder } from '../lib/api';
import { formatBDT, discountPct } from '../lib/format';
import { pixel } from '../lib/pixel';
import { FitImage } from '../components/ui/fit-image';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';

/**
 * Ad funnel landing page (/f/{slug}). Renders the tenant's block config in
 * `section_order`, with an embedded Cash-on-Delivery order form. Minimal
 * chrome (slim header/footer, no nav) + a sticky mobile CTA — built to
 * convert Facebook-ad traffic. Reuses the checkout order schema + submitOrder.
 */

const ICON_MAP: Record<string, any> = {
  'truck': Truck, 'shield-check': ShieldCheck, 'refresh-cw': RefreshCw, 'headphones': Headphones,
  'package': Package, 'credit-card': CreditCard, 'gift': Gift, 'award': Award, 'clock': Clock,
  'phone': Phone, 'heart': Heart, 'sparkles': Sparkles, 'badge-check': BadgeCheck, 'thumbs-up': ThumbsUp,
  'leaf': Leaf, 'zap': Zap, 'brain': Brain, 'flame': Flame, 'droplet': Droplet, 'smile': Smile, 'activity': Activity,
  'globe': Globe, 'message-circle': MessageCircle, 'help-circle': HelpCircle,
};
function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const C = ICON_MAP[name] || Check;
  return <C className={className} />;
}

/* Render sanitised inline rich-text HTML (bold/underline/highlight/colour/
   data-anim) authored in the dashboard editor. Values are whitelist-sanitised
   server-side (App\Support\RichText), so this is safe. */
function RT({ html, as: Tag = 'span', className }: { html: string; as?: any; className?: string }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// shipping_zone is required only when the delivery-area selector is shown
// (shipping enabled + zones). Otherwise the hidden empty field would block the
// order button with no visible error — same guard as checkout.tsx.
function makeOrderSchema(requireZone: boolean) {
  return z.object({
    customer_name:    z.string().min(2, 'Please enter your full name'),
    customer_address: z.string().min(10, 'Please enter your full delivery address'),
    customer_phone:   z.string().regex(/^(\+?88)?01[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number'),
    shipping_zone:    z.string().optional(),
    notes:            z.string().max(500).optional(),
  }).superRefine((val, ctx) => {
    if (requireZone && !(val.shipping_zone && val.shipping_zone.length > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['shipping_zone'], message: 'Choose a delivery area' });
    }
  });
}
type FormData = z.infer<ReturnType<typeof makeOrderSchema>>;

/* Fade/slide a block in as it scrolls into view (funnels are noindex + JS-only
   FB-ad traffic, so a JS-driven reveal is safe). Disabled → renders immediately. */
function Reveal({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(!enabled);
  useEffect(() => {
    if (!enabled || shown) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); } },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, shown]);
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${shown ? 'translate-y-0 opacity-100 funnel-revealed' : 'translate-y-6 opacity-0'}`}>
      {children}
    </div>
  );
}

export function FunnelPage({ funnel, meta }: { funnel: FunnelData | null; meta: StorefrontMeta | null }) {
  useEffect(() => {
    if (funnel?.product) {
      pixel.viewContent({ id: funnel.product.id, name: funnel.product.name, price: funnel.product.price });
    }
  }, [funnel]);

  if (!funnel || !meta) return <NotFound meta={meta} />;

  const { config, product } = funnel;
  const order = config.section_order ?? [];
  const fontClass = config.font === 'bengali' ? 'funnel-font-bn' : '';
  const btn: BtnTheme = { bg: (config.button_bg || '').trim(), text: (config.button_text || '').trim() };

  const renderBlock = (key: string) => {
    switch (key) {
      case 'hero':
        return config.hero.visible ? <Hero config={config.hero} product={product} btn={btn} /> : null;
      case 'benefits':
        return config.benefits.visible && config.benefits.items.length ? <Benefits config={config.benefits} /> : null;
      case 'gallery': {
        const imgs = config.gallery.image_urls?.length ? config.gallery.image_urls : product.gallery_urls;
        return config.gallery.visible && imgs.length ? <Gallery images={imgs} name={product.name} /> : null;
      }
      case 'price':
        return config.price.visible ? <PriceBlock config={config.price} product={product} /> : null;
      case 'urgency':
        return config.urgency.visible ? <Urgency config={config.urgency} /> : null;
      case 'order_form':
        return config.order_form.visible ? <OrderForm config={config.order_form} product={product} meta={meta} btn={btn} /> : null;
      case 'why_us':
        return config.why_us.visible && config.why_us.items.length ? <WhyUs config={config.why_us} /> : null;
      case 'reviews': {
        // Screenshots-only: the block shows when it's visible AND has uploaded
        // review screenshots (product catalog reviews are not used on funnels).
        const hasShots = (config.reviews.screenshot_urls?.length ?? 0) > 0;
        return config.reviews.visible && hasShots ? <Reviews config={config.reviews} /> : null;
      }
      case 'faq':
        return config.faq.visible && config.faq.items.length ? <Faq config={config.faq} /> : null;
      case 'trust_badges':
        return config.trust_badges.visible && config.trust_badges.items.length ? <TrustBadges items={config.trust_badges.items} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className={fontClass}>
      {/* No site header/nav — a funnel is a standalone landing page that opens
          straight into the hero (matches single-product COD landers). */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-28 sm:pb-10">
        {order.map((key: string) => {
          const node = renderBlock(key);
          if (!node) return null;
          const bg = (config as unknown as Record<string, SectionBgFields>)[key];
          // Every section with a background spans the full viewport width on
          // wide screens (edge-to-edge band, teachek-style); the split hero
          // bleeds even without one. Content re-centres in the max-w-6xl column.
          const hasBg = !!bg && !!bg.bg_type && bg.bg_type !== 'none';
          const bleed = hasBg || (key === 'hero' && config.hero.layout === 'split');
          // SectionBg owns the per-section vertical spacing now (it pads inside
          // the band, so "Top: None" makes the hero flush — no outer wrapper).
          return (
            <Reveal key={key} enabled={config.animate !== false}>
              <SectionBg bg={bg} bleed={bleed}>{node}</SectionBg>
            </Reveal>
          );
        })}
      </main>
      <SlimFooter meta={meta} />
      <StickyCta label={config.hero.cta_label || 'Order Now'} btn={btn} />
    </div>
  );
}

/* ── Footer (minimal) ─────────────────────────────────────────────────── */
function SlimFooter({ meta }: { meta: StorefrontMeta }) {
  return (
    <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
      <p>© {new Date().getFullYear()} {meta.name}</p>
    </footer>
  );
}

function StickyCta({ label, btn }: { label: string; btn: BtnTheme }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden">
      <a href="#funnel-order" className={ctaClass('block w-full rounded-xl py-3 text-center text-base font-bold shadow', btn)} style={ctaStyle(btn)}>{label}</a>
    </div>
  );
}

/* ── Blocks ───────────────────────────────────────────────────────────── */
// Luminance test → pick readable text colour over a coloured background.
function isDarkHex(hex?: string): boolean {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 140;
}

// Reusable per-section background — one mode at a time (solid colour / gradient
// / image), used to wrap EVERY block. Dark backgrounds get .funnel-dark so the
// CSS whitens text (inline rich-text colours still win); image gets a baked-in
// dark scrim. No background → renders children untouched.
type SectionBgFields = {
  bg_type?: 'none' | 'color' | 'gradient' | 'image' | 'pattern';
  bg_color?: string;
  bg_gradient_from?: string;
  bg_gradient_to?: string;
  bg_gradient_angle?: number;
  bg_image_url?: string | null;
  bg_pattern?: string;
  space_top?: 'none' | 'sm' | 'md' | 'lg';
  space_bottom?: 'none' | 'sm' | 'md' | 'lg';
};

// Per-section spacing presets → the section's OWN top/bottom padding. For a
// section with a background this is the padding INSIDE the band (so "Top: None"
// makes content sit flush at the top); otherwise it's plain vertical spacing.
// Default md is intentionally modest so heroes don't open with a tall gap.
const PAD_TOP: Record<string, string> = { none: 'pt-0', sm: 'pt-4', md: 'pt-8', lg: 'pt-14' };
const PAD_BOTTOM: Record<string, string> = { none: 'pb-0', sm: 'pb-4', md: 'pb-8', lg: 'pb-14' };

// Funnel-wide button (CTA) theme. Blank values fall back to the brand colour
// (via Tailwind classes) / white, so an unconfigured funnel looks unchanged.
type BtnTheme = { bg: string; text: string };
function ctaClass(base: string, b: BtnTheme): string {
  return [
    base,
    b.bg ? '' : 'bg-brand-600 hover:bg-brand-700',
    b.text ? '' : 'text-white',
    (b.bg || b.text) ? 'hover:opacity-90' : '',
  ].filter(Boolean).join(' ');
}
function ctaStyle(b: BtnTheme): CSSProperties | undefined {
  if (!b.bg && !b.text) return undefined;
  const s: CSSProperties = {};
  if (b.bg) s.backgroundColor = b.bg;
  if (b.text) s.color = b.text;
  return s;
}

/** Hex (#rrggbb) → rgba() string at the given alpha (for the pattern's light wash). */
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim());
  if (!m) return `rgba(15,23,42,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Tiled-pattern motifs (100×100 tile). Rendered as a faint, tenant-coloured SVG
// that slowly drifts (.fnl-bg-pattern). leaves → organic; dots/grid → geometric.
const PATTERN_MOTIFS: Record<string, string> = {
  leaves: "<path d='M50 18c-9 7-9 23 0 30 9-7 9-23 0-30z'/><path d='M22 64c-6 5-6 16 0 21 6-5 6-16 0-21z'/><circle cx='78' cy='30' r='4'/><circle cx='30' cy='86' r='3'/>",
  dots:   "<circle cx='25' cy='25' r='4'/><circle cx='75' cy='75' r='4'/><circle cx='75' cy='25' r='2.5'/><circle cx='25' cy='75' r='2.5'/>",
  grid:   "<path d='M0 50h100M50 0v100'/>",
};

function patternUrl(motif: string, hex: string): string {
  const m = PATTERN_MOTIFS[motif] ?? PATTERN_MOTIFS.leaves;
  const g = motif === 'grid'
    ? `<g stroke='${hex}' stroke-opacity='0.06' stroke-width='2' fill='none'>${m}</g>`
    : `<g fill='${hex}' fill-opacity='0.06'>${m}</g>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 100 100'>${g}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
function SectionBg({ bg, bleed = false, children }: { bg?: SectionBgFields; bleed?: boolean; children: ReactNode }) {
  const t = bg?.bg_type || 'none';
  // Vertical padding comes from the per-section spacing preset (top + bottom
  // independent); horizontal padding is fixed.
  const vy = `${PAD_TOP[bg?.space_top ?? 'md'] ?? PAD_TOP.md} ${PAD_BOTTOM[bg?.space_bottom ?? 'md'] ?? PAD_BOTTOM.md}`;
  // bleed → the background spans the full viewport width (edge-to-edge) and the
  // content is re-centred in a wider container. Used by the split hero so it
  // looks full-width on desktop instead of a narrow centred card.
  const padded = bleed ? `fnl-full-bleed px-4 sm:px-6 ${vy}` : `rounded-3xl px-5 ${vy}`;
  const inner = (node: ReactNode) => (bleed ? <div className="mx-auto max-w-6xl">{node}</div> : node);

  // Pattern: a light wash of the colour + a faint tiled motif that slowly
  // drifts. Two layers (wash + pattern) so text on top stays dark & readable.
  if (t === 'pattern') {
    const color = bg!.bg_color || '#0f172a';
    return (
      <div className={`relative overflow-hidden ${padded}`} style={{ backgroundColor: hexA(color, 0.10) }}>
        <div className="fnl-bg-pattern pointer-events-none absolute inset-0" aria-hidden="true"
             style={{ backgroundImage: patternUrl(bg!.bg_pattern || 'leaves', color), backgroundRepeat: 'repeat' }} />
        <div className="relative">{inner(children)}</div>
      </div>
    );
  }

  let style: CSSProperties = {};
  let dark = false;
  let has = false;
  if (t === 'color') {
    style = { background: bg!.bg_color || '#0f172a' };
    dark = isDarkHex(bg!.bg_color);
    has = true;
  } else if (t === 'gradient') {
    style = { background: `linear-gradient(${bg!.bg_gradient_angle ?? 135}deg, ${bg!.bg_gradient_from || '#6366f1'}, ${bg!.bg_gradient_to || '#f59e0b'})` };
    dark = isDarkHex(bg!.bg_gradient_from);
    has = true;
  } else if (t === 'image' && bg!.bg_image_url) {
    style = {
      backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${JSON.stringify(bg!.bg_image_url)})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
    dark = true;
    has = true;
  }
  if (!has) {
    // No background — still apply the section's own vertical spacing. bleed
    // also widens the content (split hero) edge-to-edge.
    return bleed
      ? <div className={`fnl-full-bleed px-4 sm:px-6 ${vy}`}><div className="mx-auto max-w-6xl">{children}</div></div>
      : <div className={vy}>{children}</div>;
  }
  return <div className={`${padded} ${dark ? 'funnel-dark' : ''}`} style={style}>{inner(children)}</div>;
}

function Hero({ config, product, btn }: { config: FunnelBlockConfig['hero']; product: FunnelProduct; btn: BtnTheme }) {
  const img = config.image_url || product.image_url;
  const base = 'mt-1 text-2xl font-extrabold leading-tight sm:text-4xl';
  const split = config.layout === 'split';
  const slides = config.slide_urls && config.slide_urls.length > 0 ? config.slide_urls : (img ? [img] : []);

  // headline is sanitized inline HTML (bold/underline/highlight/colour);
  // fall back to the plain product name when empty.
  const html = (config.headline || '').trim();
  const hs = config.headline_style || 'plain';
  const headline = (() => {
    if (hs === 'gradient') {
      const cls = `${base} bg-gradient-to-r from-brand-500 to-amber-500 bg-clip-text text-transparent`;
      return html ? <h1 className={cls} dangerouslySetInnerHTML={{ __html: html }} /> : <h1 className={cls}>{product.name}</h1>;
    }
    if (hs === 'highlight') {
      return (
        <h1 className={base}>
          <span className="box-decoration-clone rounded bg-brand-100 px-2 text-brand-900">
            {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : product.name}
          </span>
        </h1>
      );
    }
    const cls = `${base} text-slate-900`;
    return html ? <h1 className={cls} dangerouslySetInnerHTML={{ __html: html }} /> : <h1 className={cls}>{product.name}</h1>;
  })();

  // Media: slider (>1 slide) / single image / nothing. The frame (white border)
  // is added by the SPLIT layout; centred shows it plain (unchanged look).
  const media = slides.length > 1
    ? <HeroSlider images={slides} alt={product.name} />
    : slides.length === 1
      ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          <FitImage src={slides[0]} alt={product.name} eager />
        </div>
      )
      : null;

  const eyebrow = config.eyebrow
    ? <RT as="p" className="text-sm font-semibold uppercase tracking-wide text-brand-600" html={config.eyebrow} />
    : null;
  const cta = (
    <a href="#funnel-order" className={ctaClass('inline-flex items-center gap-2 rounded-xl px-7 py-3 text-base font-bold shadow transition', btn)} style={ctaStyle(btn)}>
      <ShoppingBag className="h-5 w-5" /> <RT html={config.cta_label || 'Order Now'} />
    </a>
  );

  // SPLIT — text + accent-boxed sub on the left, framed image card on the right
  // (stacks on mobile). The white p-2 frame mimics the teachek-style card.
  if (split) {
    return (
      <section className="grid items-center gap-8 lg:min-h-[560px] lg:grid-cols-2">
        <div className="text-center lg:text-left">
          {eyebrow}
          {headline}
          {config.subheadline && (
            <div className="mx-auto mt-4 max-w-xl rounded-r-xl border-l-4 border-brand-500 bg-white px-4 py-3 text-left shadow-sm lg:mx-0">
              <p className="text-slate-600" dangerouslySetInnerHTML={{ __html: config.subheadline }} />
            </div>
          )}
          <div className="mt-6 flex justify-center lg:justify-start">{cta}</div>
        </div>
        {media && (
          <div className="rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-200">
            <div className="overflow-hidden rounded-xl">{media}</div>
          </div>
        )}
      </section>
    );
  }

  // CENTERED (default — unchanged)
  return (
    <section className="text-center">
      {eyebrow}
      {headline}
      {config.subheadline && <p className="mx-auto mt-3 max-w-2xl text-slate-600" dangerouslySetInnerHTML={{ __html: config.subheadline }} />}
      {media && <div className="mx-auto mt-5 max-w-2xl">{media}</div>}
      <div className="mt-5">{cta}</div>
    </section>
  );
}

/* Auto-fading hero image slider (client island, so JS is fine). */
function HeroSlider({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % images.length), 3500);
    return () => clearInterval(t);
  }, [images.length]);
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
      {images.map((src, idx) => (
        <img key={idx} src={src} alt={alt} loading={idx === 0 ? 'eager' : 'lazy'}
             className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${idx === i ? 'opacity-100' : 'opacity-0'}`} />
      ))}
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {images.map((_, idx) => (
          <button key={idx} type="button" aria-label={`Slide ${idx + 1}`} onClick={() => setI(idx)}
                  className={`h-2 rounded-full transition-all ${idx === i ? 'w-5 bg-white' : 'w-2 bg-white/60'}`} />
        ))}
      </div>
    </div>
  );
}

/* Image-based review screenshots — a 3D COVERFLOW carousel (the teachek look):
   centre card upright + prominent, side cards rotate back in perspective. Built
   on Embla (already a dependency) so it drags with a mouse on desktop AND swipes
   on touch. Cards are a FIXED height so Embla's geometry is stable even while
   the tall screenshots are still loading (the earlier loop drifted off-screen
   exactly because lazy images mis-measured the slides). No loop — autoplay wraps
   back to the start; the 3D transform is tweened from scroll progress. */
function ReviewScreenshots({ images }: { images: string[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'center', containScroll: false });
  const cards = useRef<HTMLElement[]>([]);
  const factor = useRef(1);

  const tween = useCallback((api: any) => {
    const engine = api.internalEngine();
    const progress = api.scrollProgress();
    api.scrollSnapList().forEach((snap: number, snapIndex: number) => {
      const diff = snap - progress;
      engine.slideRegistry[snapIndex].forEach((slideIndex: number) => {
        const node = cards.current[slideIndex];
        if (!node) return;
        const d = diff * factor.current;                 // ~0 centre, ±1 neighbour
        const c = Math.max(-1.6, Math.min(1.6, d));
        // teachek look: centre card flat + upright, neighbours rotate back ~45°
        // in REAL perspective (the slide wrapper is preserve-3d, so this no longer
        // flattens). translateZ pushes them back; perspective does the shrinking,
        // so the scale nudge stays small. Cards stay bright; a dark shade gives the
        // Swiper-style "slideShadows" depth cue.
        node.style.transform = `rotateY(${c * -45}deg) translateZ(${-Math.abs(c) * 90}px) scale(${1 - Math.min(Math.abs(d), 1) * 0.05})`;
        node.style.opacity = '1';
        node.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
        const shade = node.querySelector('.cf-shade') as HTMLElement | null;
        if (shade) shade.style.opacity = (Math.min(Math.abs(d), 1) * 0.32).toFixed(3);
      });
    });
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const apply = () => {
      cards.current = emblaApi.slideNodes().map((s: HTMLElement) => s.querySelector('.cf-card') as HTMLElement);
      factor.current = Math.max(1, emblaApi.scrollSnapList().length - 1);
      tween(emblaApi);
    };
    apply();
    emblaApi.on('reInit', apply);
    emblaApi.on('scroll', () => tween(emblaApi));

    // Re-measure once the lazy screenshots have loaded (Embla sizes the snaps
    // at init, before tall images give the slides their real height).
    const imgs = Array.from(emblaApi.rootNode().querySelectorAll('img')) as HTMLImageElement[];
    let pending = imgs.length;
    const onOne = () => { if (--pending <= 0) emblaApi.reInit(); };
    imgs.forEach((img) => { if (img.complete) onOne(); else img.addEventListener('load', onOne, { once: true }); });

    // Open balanced (middle card centred), then auto-advance; wrap at the end.
    emblaApi.scrollTo(Math.floor(emblaApi.slideNodes().length / 2), true);
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => { if (emblaApi.canScrollNext()) emblaApi.scrollNext(); else emblaApi.scrollTo(0); };
    const start = () => { if (!timer) timer = setInterval(tick, 3000); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    start();
    emblaApi.on('pointerDown', stop);
    emblaApi.on('pointerUp', start);
    const root = emblaApi.rootNode();
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    return () => { stop(); root.removeEventListener('mouseenter', stop); root.removeEventListener('mouseleave', start); };
  }, [emblaApi, tween]);

  // One image → no carousel, just a centred card. (After the hooks so the
  // Rules of Hooks hold; Embla simply never mounts since emblaRef is unused.)
  if (images.length === 1) {
    return (
      <div className="mx-auto max-w-xs">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100 shadow-xl ring-1 ring-slate-200">
          <img src={images[0]} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
          <img src={images[0]} alt="Customer review" loading="lazy" className="relative z-[1] h-full w-full object-contain" />
        </div>
      </div>
    );
  }

  return (
    // Full-bleed band, but the cards live in a centred container capped to the
    // SAME width as every other funnel section (max-w-6xl) so the 3 cards line
    // up flush with the hero / order form / etc. on wide screens instead of
    // spreading wider. Full-bleed only lets the rotated side cards breathe past
    // the column on narrower screens without clipping.
    <div className="fnl-full-bleed">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden" ref={emblaRef} style={{ perspective: '1300px' }}>
          <div className="flex" style={{ transformStyle: 'preserve-3d' }}>
            {images.map((src, i) => (
              <div key={i} className="relative min-w-0 shrink-0 grow-0 basis-[82%] cursor-grab px-2.5 active:cursor-grabbing sm:basis-1/2 lg:basis-[30%]"
                   style={{ transformStyle: 'preserve-3d' }}>
              {/* lg cards are <1/3 width so the 3 cards sit centred WITH side
                  margin — the rotated side cards then stay fully inside the
                  overflow-hidden window instead of being sliced flat at the
                  edges (the earlier "cropping"). */}
              {/* aspect-ratio (not a fixed px height) keeps cards a uniform shape
                  AND gives Embla a stable size before images load. The full
                  screenshot shows via object-contain over a blurred self-fill,
                  so nothing is cropped regardless of the upload's dimensions. */}
              <div className="cf-card relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100 shadow-2xl ring-1 ring-slate-200 will-change-transform"
                   style={{ transformOrigin: 'center center' }}>
                <img src={src} aria-hidden="true" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full scale-110 select-none object-cover opacity-50 blur-2xl" />
                <img src={src} alt={`Customer review ${i + 1}`} loading="lazy" draggable={false} className="relative z-[1] h-full w-full select-none object-contain" />
                <div className="cf-shade pointer-events-none absolute inset-0 z-[2] bg-slate-900" style={{ opacity: 0 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="button" aria-label="Previous reviews" onClick={() => emblaApi?.scrollPrev()}
              className="absolute left-3 top-1/2 z-[200] hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/95 p-2.5 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-white sm:flex">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button type="button" aria-label="Next reviews" onClick={() => emblaApi?.scrollNext()}
              className="absolute right-3 top-1/2 z-[200] hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/95 p-2.5 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-white sm:flex">
        <ChevronRight className="h-5 w-5" />
      </button>
      </div>
    </div>
  );
}

// Benefit tile palette — soft tinted card + a darker icon-tile, keyed by `tone`.
const BENEFIT_TONES: Record<string, { bg: string; tile: string }> = {
  amber:   { bg: 'bg-amber-50',  tile: 'bg-amber-100 text-amber-700' },
  emerald: { bg: 'bg-brand-50',  tile: 'bg-brand-100 text-brand-700' },
  rose:    { bg: 'bg-rose-50',   tile: 'bg-rose-100 text-rose-600' },
  sky:     { bg: 'bg-sky-50',    tile: 'bg-sky-100 text-sky-700' },
  purple:  { bg: 'bg-purple-50', tile: 'bg-purple-100 text-purple-700' },
  slate:   { bg: 'bg-slate-50',  tile: 'bg-slate-100 text-slate-700' },
};
type BenefitItem = { icon?: string; tone?: string; title?: string; body?: string };
// Back-compat: legacy benefits were plain strings → render as a title-only card.
function normBenefit(b: string | BenefitItem): BenefitItem {
  return typeof b === 'string' ? { icon: 'sparkles', tone: 'emerald', title: b, body: '' } : (b || {});
}
function Benefits({ config }: { config: FunnelBlockConfig['benefits'] }) {
  const items = (config.items as (string | BenefitItem)[])
    .map(normBenefit)
    .filter((b) => (b.title || '').trim() !== '' || (b.body || '').trim() !== '');
  if (!items.length) return null;
  const lastIdx = items.length - 1;
  return (
    <section>
      {config.title && <RT as="h2" className="mb-6 text-center text-2xl font-extrabold text-slate-900 sm:text-3xl" html={config.title} />}
      <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b, i) => {
          const featured = i === lastIdx && items.length > 1;
          const tone = BENEFIT_TONES[b.tone || 'emerald'] ?? BENEFIT_TONES.emerald;
          // Featured = wide dark card, icon on the left (mirrors the reference).
          if (featured) {
            return (
              <div key={i} className="flex items-center gap-5 rounded-2xl bg-brand-700 p-6 text-white shadow-sm sm:col-span-2 lg:col-span-2">
                <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                  <BadgeIcon name={b.icon || 'sparkles'} className="h-7 w-7 text-white" />
                </div>
                <div>
                  {b.title && <RT as="h3" className="text-lg font-bold leading-snug" html={b.title} />}
                  {b.body && <RT as="p" className="mt-1 text-sm text-white/85" html={b.body} />}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className={`rounded-2xl ${tone.bg} p-6 ring-1 ring-black/5`}>
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tone.tile}`}>
                <BadgeIcon name={b.icon || 'sparkles'} className="h-6 w-6" />
              </div>
              {b.title && <RT as="h3" className="font-bold leading-snug text-slate-900" html={b.title} />}
              {b.body && <RT as="p" className="mt-1 text-sm text-slate-600" html={b.body} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Gallery({ images, name }: { images: string[]; name: string }) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {images.slice(0, 8).map((src, i) => (
        <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
          <img src={src} alt={`${name} — photo ${i + 1}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        </div>
      ))}
    </section>
  );
}

function PriceBlock({ config, product }: { config: FunnelBlockConfig['price']; product: FunnelProduct }) {
  const off = discountPct(product.price, product.compare_at_price);
  return (
    <section className="text-center">
      <div className="inline-flex flex-wrap items-baseline justify-center gap-3 rounded-2xl bg-brand-50 px-6 py-4 ring-1 ring-brand-100">
        <span className="text-3xl font-extrabold text-rose-600">{formatBDT(product.price, { currency: product.currency })}</span>
        {product.compare_at_price && product.compare_at_price > product.price && (
          <span className="text-lg text-slate-400 line-through">{formatBDT(product.compare_at_price, { currency: product.currency })}</span>
        )}
        {off && <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">Save {off}%</span>}
      </div>
      {config.note && <RT as="p" className="mt-2 text-sm text-slate-500" html={config.note} />}
    </section>
  );
}

function Urgency({ config }: { config: FunnelBlockConfig['urgency'] }) {
  const [left, setLeft] = useState((config.countdown_minutes || 0) * 60);
  useEffect(() => {
    if (!config.countdown_minutes) return;
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [config.countdown_minutes]);
  const hh = String(Math.floor(left / 3600)).padStart(2, '0');
  const mm = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <section className="rounded-2xl bg-amber-50 px-5 py-4 text-center ring-1 ring-amber-200">
      <p className="flex items-center justify-center gap-2 font-bold text-amber-900"><Clock className="h-5 w-5" /> <RT html={config.headline} /></p>
      {config.stock_text && <RT as="p" className="mt-1 text-sm text-amber-700" html={config.stock_text} />}
      {config.countdown_minutes > 0 && <p className="mt-2 text-2xl font-extrabold tabular-nums text-amber-900">{hh}:{mm}:{ss}</p>}
    </section>
  );
}

function WhyUs({ config }: { config: FunnelBlockConfig['why_us'] }) {
  return (
    <section>
      {config.title && <RT as="h2" className="mb-4 text-center text-xl font-bold text-slate-900" html={config.title} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {config.items.map((w, i) => (
          <div key={i} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <RT as="p" className="font-semibold text-slate-900" html={w.title} />
            {w.body && <RT as="p" className="mt-1 text-sm text-slate-600" html={w.body} />}
          </div>
        ))}
      </div>
    </section>
  );
}

// Funnel reviews = the curated screenshot carousel ONLY. The product's catalog
// text reviews are deliberately NOT shown here — a funnel is a single-product ad
// lander, and pulling in generic store reviews (often unrelated to this product)
// reads as noise. Upload review screenshots for social proof instead.
function Reviews({ config }: { config: FunnelBlockConfig['reviews'] }) {
  const shots = config.screenshot_urls ?? [];
  if (shots.length === 0) return null;
  return (
    <section>
      {config.title && (
        <div className="mb-6 text-center">
          <RT as="h2" className="text-2xl font-extrabold text-slate-900 sm:text-3xl" html={config.title} />
          {/* teachek-style accent underline under the section title */}
          <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-brand-500" />
        </div>
      )}
      <ReviewScreenshots images={shots} />
    </section>
  );
}

function Faq({ config }: { config: FunnelBlockConfig['faq'] }) {
  return (
    <section>
      <h2 className="mb-4 text-center text-xl font-bold text-slate-900">FAQ</h2>
      <div className="mx-auto grid max-w-4xl items-start gap-3 sm:grid-cols-2">
        {config.items.map((f, i) => (
          <details key={i} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <summary className="cursor-pointer font-semibold text-slate-900"><RT html={f.q} /></summary>
            <RT as="p" className="mt-2 text-sm leading-relaxed text-slate-600" html={f.a} />
          </details>
        ))}
      </div>
    </section>
  );
}

function TrustBadges({ items }: { items: { icon: string; title: string }[] }) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((b, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 rounded-xl bg-white p-4 text-center ring-1 ring-slate-200">
          <BadgeIcon name={b.icon} className="h-6 w-6 text-brand-600" />
          <RT className="text-xs font-medium text-slate-700" html={b.title} />
        </div>
      ))}
    </section>
  );
}

/* ── Order form (COD) — reuses the checkout schema + submitOrder ──────── */
function OrderForm({ config, product, meta, btn }: { config: FunnelBlockConfig['order_form']; product: FunnelProduct; meta: StorefrontMeta; btn: BtnTheme }) {
  const [qty, setQty] = useState(1);
  const [variantIdx, setVariantIdx] = useState<number | null>(product.variants[0]?.index ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zones = meta.shipping?.zones ?? [];
  const requireZone = !!(meta.shipping?.enabled && zones.length > 0);
  const schema = useMemo(() => makeOrderSchema(requireZone), [requireZone]);
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { shipping_zone: zones[0]?.code ?? '' } });

  const variant = (variantIdx != null ? product.variants.find((v) => v.index === variantIdx) : null) ?? null;
  const unitPrice = variant?.price ?? product.price;
  const inStock = variant ? variant.in_stock : product.in_stock;

  const selectedZone = form.watch('shipping_zone');
  const zone = zones.find((z) => z.code === selectedZone);
  const subtotal = unitPrice * qty;
  const threshold = meta.shipping?.free_shipping_threshold ?? null;
  const shippingFee = !meta.shipping?.enabled ? 0 : (threshold && subtotal >= threshold ? 0 : (zone?.fee ?? 0));
  const total = subtotal + shippingFee;

  async function onSubmit(values: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      pixel.initiateCheckout({ value: subtotal, numItems: qty });
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const orderRes = await submitOrder({
        customer_name:  values.customer_name,
        customer_phone: values.customer_phone,
        address:        values.customer_address,
        shipping_zone:  values.shipping_zone || undefined,
        notes:          values.notes,
        // Funnels are single-product by design — a 1-element items[] cart.
        items: [{ product_id: product.id, variant_index: variant ? variant.index : null, quantity: qty }],
        utm_source:     sp?.get('utm_source') || undefined,
        utm_medium:     sp?.get('utm_medium') || undefined,
        utm_campaign:   sp?.get('utm_campaign') || undefined,
        funnel_url:     typeof window !== 'undefined' ? window.location.href : undefined,
      });
      pixel.purchase({ orderNumber: orderRes.order_number, value: orderRes.total, numItems: qty, contentIds: [product.id.toString()] });
      window.location.href = `/order/${orderRes.order_number}?placed=1&phone=${values.customer_phone.slice(-4)}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <section id="funnel-order" className="mx-auto max-w-2xl scroll-mt-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
      <RT as="h2" className="text-center text-lg font-bold text-slate-900" html={config.heading || 'Order now — Cash on Delivery'} />

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

        {product.variants.length > 0 && (
          <div>
            <Label>{product.variants.length > 1 ? 'Choose your pack' : 'Option'}</Label>
            <div className="mt-1.5 grid gap-2">
              {product.variants.map((v) => {
                const vp = v.price ?? product.price;
                const vc = v.compare_at_price ?? product.compare_at_price;
                const off = discountPct(vp, vc);
                const selected = variantIdx === v.index;
                return (
                  <button type="button" key={v.index} disabled={!v.in_stock} onClick={() => setVariantIdx(v.index)}
                          className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-300 hover:border-slate-400'} ${!v.in_stock ? 'cursor-not-allowed opacity-40' : ''}`}>
                    <span className="flex items-center gap-2">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-brand-500' : 'border-slate-300'}`}>
                        {selected && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{v.label}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block">
                        <span className="text-sm font-bold text-rose-600">{formatBDT(vp, { currency: product.currency })}</span>
                        {vc && vc > vp && <span className="ml-1 text-xs text-slate-400 line-through">{formatBDT(vc, { currency: product.currency })}</span>}
                        {off && <span className="ml-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">-{off}%</span>}
                      </span>
                      {vc && vc > vp && (
                        <span className="mt-0.5 block text-[11px] font-semibold text-emerald-600">Save {formatBDT(vc - vp, { currency: product.currency })}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="f-name">Full Name <span className="text-rose-500">*</span></Label>
          <Input id="f-name" placeholder="Your name" {...form.register('customer_name')} className="mt-1.5" />
          {form.formState.errors.customer_name && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.customer_name.message}</p>}
        </div>
        <div>
          <Label htmlFor="f-phone">Phone <span className="text-rose-500">*</span></Label>
          <Input id="f-phone" placeholder="01XXXXXXXXX" inputMode="tel" {...form.register('customer_phone')} className="mt-1.5" />
          {form.formState.errors.customer_phone && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.customer_phone.message}</p>}
        </div>
        <div>
          <Label htmlFor="f-address">Address <span className="text-rose-500">*</span></Label>
          <Textarea id="f-address" placeholder="House/road, area, district…" {...form.register('customer_address')} className="mt-1.5" />
          {form.formState.errors.customer_address && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.customer_address.message}</p>}
        </div>

        {meta.shipping?.enabled && zones.length > 0 && (
          <div>
            <Label className="flex items-center gap-2"><Truck className="h-4 w-4" /> Delivery area</Label>
            <RadioGroup value={selectedZone} onValueChange={(v) => form.setValue('shipping_zone', v)} className="mt-1.5 grid grid-cols-2 gap-2">
              {zones.map((z) => (
                <label key={z.code} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition ${selectedZone === z.code ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <RadioGroupItem value={z.code} />
                  <span className="text-sm font-medium text-slate-900">{z.label}</span>
                </label>
              ))}
            </RadioGroup>
            {form.formState.errors.shipping_zone && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.shipping_zone.message}</p>}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-sm font-medium text-slate-700">Quantity</span>
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-300">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Decrease" className="px-2 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
            <button type="button" onClick={() => setQty(qty + 1)} aria-label="Increase" className="px-2 py-1.5 text-slate-600 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatBDT(subtotal, { currency: product.currency })}</span></div>
          {meta.shipping?.enabled && (
            <div className="flex justify-between text-slate-600">
              <span>Shipping</span>
              <span>{shippingFee === 0 ? <span className="font-semibold text-brand-600">Free</span> : formatBDT(shippingFee, { currency: product.currency })}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
            <span className="font-bold text-slate-900">Total</span>
            <span className="text-xl font-bold text-rose-600">{formatBDT(total, { currency: product.currency })}</span>
          </div>
        </div>

        <Button type="submit" variant="brand" size="lg" className={`w-full shadow-md${(btn.bg || btn.text) ? ' hover:opacity-90' : ''}`} style={ctaStyle(btn)} disabled={!inStock || submitting}>
          <ShoppingBag className="h-4 w-4" />
          {submitting ? 'Placing order…' : !inStock ? 'Out of stock' : <RT html={config.button_label || 'Confirm Order'} />}
        </Button>
      </form>
    </section>
  );
}

function NotFound({ meta }: { meta: StorefrontMeta | null }) {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">This page doesn't exist or is no longer available.</p>
      <a href="/" className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white">Go home</a>
    </main>
  );
}
