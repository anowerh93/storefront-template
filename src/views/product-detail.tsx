import { useState } from 'react';
import { Star, Phone, Facebook, MessageCircle, Mail, Link2, Check, ShoppingBag, ShoppingCart, Minus, Plus } from 'lucide-react';
import { formatBDT, discountPct } from '../lib/format';
import { getIcon } from '../lib/icons';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { FitImage } from '../components/ui/fit-image';
import { NotFoundPage } from './not-found';
import { useCart, lineCeiling } from '../stores/cart';
import { pixel } from '../lib/pixel';
import type { ProductDetail, StorefrontMeta } from '../lib/types';

/**
 * Product detail page — single catalog-style layout for every product
 * (replaces the old funnel/standard split). Structure mirrors the
 * reference: gallery (vertical thumbs + big image) + buy box on top,
 * a share row, then a tabbed content area beside a "You May Also Like"
 * + "Quick Summary" sidebar.
 *
 * No inline order form / no cart — the buy box's "Order Now" links to the
 * dedicated /checkout page with the chosen variant.
 */
export function ProductDetailPage({
  product,
  meta,
}: {
  product: ProductDetail | null;
  meta: StorefrontMeta | null;
}) {
  if (!product || !meta) return <NotFoundPage />;

  const category = product.categories?.[0] ?? null;

  return (
    <>
      <Header meta={meta} />

      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-5 pb-16">
        {/* Breadcrumb */}
        <nav className="mb-4 text-xs text-slate-500">
          <a href="/" className="hover:text-brand-600">Home</a>
          <span className="mx-2">/</span>
          {category && (
            <>
              <a href={`/categories/${category.slug}`} className="hover:text-brand-600">{category.name}</a>
              <span className="mx-2">/</span>
            </>
          )}
          <span className="text-slate-700">{product.name}</span>
        </nav>

        {/* Top: gallery + buy box. min-w-0 on both cells: a grid item defaults
            to min-width:auto, so the thumbnail rail's min-content (6 thumbs ×
            64px + gaps = 424px) would size the single mobile column past the
            375px viewport — stretching the buy box with it and clipping the
            "Status" chip + 6th thumb off-screen. min-w-0 keeps the track at
            viewport width so the rail scrolls internally instead. */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10">
          <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <ProductGallery product={product} />
          </div>
          <BuyBox product={product} meta={meta} />
        </div>

        {/* Share */}
        <ShareRow name={product.name} />

        {/* Tabs + sidebar */}
        <div className="mt-8 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
          <ProductTabs product={product} meta={meta} />
          <Sidebar product={product} meta={meta} category={category} />
        </div>
      </main>

      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} />
    </>
  );
}

/* ── Gallery: vertical thumbnails + big image ─────────────────────────── */
function ProductGallery({ product }: { product: ProductDetail }) {
  const urls = [
    ...(product.image_url ? [product.image_url] : []),
    ...(product.gallery_urls ?? []),
  ].filter((u, i, arr) => !!u && arr.indexOf(u) === i);
  const [active, setActive] = useState(0);

  if (urls.length === 0) {
    return <div className="aspect-square rounded-2xl bg-slate-100" />;
  }

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {urls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto sm:flex-col sm:overflow-visible">
          {urls.slice(0, 6).map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-2 transition ${i === active ? 'ring-brand-500' : 'ring-slate-200 hover:ring-slate-300'}`}
            >
              <img src={src} alt={`${product.name} — photo ${i + 1}`} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-square flex-1 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <FitImage src={urls[active]} alt={product.name} eager />
      </div>
    </div>
  );
}

/* ── Buy box ──────────────────────────────────────────────────────────── */
function BuyBox({ product, meta }: { product: ProductDetail; meta: StorefrontMeta }) {
  const [variantIdx, setVariantIdx] = useState<number | null>(product.variants[0]?.index ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const addToCart = useCart((s) => s.addToCart);
  const selected = product.variants.find((v) => v.index === variantIdx) ?? null;
  const unitPrice = selected?.price ?? product.price;
  const inStock = selected ? selected.in_stock : product.in_stock;
  const maxStock = selected ? selected.stock : null;
  const discount = discountPct(unitPrice, product.compare_at_price);
  const benefits = product.funnel?.benefits ?? [];
  const phone = meta.whatsapp?.trim() || null;

  // "Order Now" is an express single-item buy-now; "Add to Cart" stacks lines
  // for a combined checkout. Both carry the chosen variant + quantity.
  const checkoutHref = `/checkout?p=${encodeURIComponent(product.slug)}${variantIdx != null ? `&v=${variantIdx}` : ''}&q=${qty}`;

  function handleAddToCart() {
    if (!inStock) return;
    addToCart(
      {
        product_id: product.id,
        slug: product.slug,
        name: product.name,
        image_url: product.image_url ?? product.gallery_urls?.[0] ?? null,
        variant_index: selected ? selected.index : null,
        variant_label: selected ? selected.label : null,
        unit_price: unitPrice,
        max_stock: maxStock,
        currency: product.currency,
      },
      qty,
    );
    pixel.addToCart({ id: product.id, name: product.name, price: unitPrice, quantity: qty, currency: product.currency });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    // min-w-0: sibling grid cell of the gallery — see the grid comment above.
    <div className="min-w-0 space-y-5">
      <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{product.name}</h1>

      {(product.rating_count ?? 0) > 0 && product.rating_avg != null && (
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`h-4 w-4 ${n <= Math.round(product.rating_avg!) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
            ))}
          </div>
          <span className="font-semibold text-slate-900">{product.rating_avg.toFixed(1)}</span>
          <span className="text-slate-500">({product.rating_count} reviews)</span>
        </div>
      )}

      {/* Feature list (Key selling points — {icon, title}; legacy rows were strings) */}
      {benefits.length > 0 && (
        <ul className="space-y-2.5">
          {benefits.map((b, i) => {
            const title = typeof b === 'string' ? b : (b?.title ?? '');
            if (!title) return null;
            const Icon = getIcon(typeof b === 'string' ? 'badge-check' : (b?.icon || 'badge-check'));
            return (
              <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="leading-relaxed pt-0.5">{title}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Contact line */}
      {phone && (
        <p className="border-t border-slate-100 pt-4 text-base font-bold text-slate-900">
          Details :{' '}
          <a href={`tel:${phone.replace(/\s/g, '')}`} className="font-semibold text-brand-600 hover:underline">
            <Phone className="mb-0.5 mr-1 inline h-4 w-4" />{phone}
          </a>
        </p>
      )}

      {/* Price + status — Status sits on its OWN line under the price
          (reference layout), not pushed to the right of the price row where
          it competes for width on phones. */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-medium text-slate-500">Price:</span>
          <span className="text-2xl font-bold text-rose-600">{formatBDT(unitPrice, { currency: product.currency })}</span>
          {product.compare_at_price && product.compare_at_price > unitPrice && (
            <span className="text-base text-slate-500 line-through">{formatBDT(product.compare_at_price, { currency: product.currency })}</span>
          )}
          {discount && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">Save {discount}%</span>}
        </div>
        <p className="text-sm text-slate-700">
          Status: <span className={inStock ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{inStock ? 'In Stock' : 'Out of Stock'}</span>
        </p>
      </div>

      {/* Variant picker (only if the product has variants) */}
      {product.variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Choose option</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button
                key={v.index}
                type="button"
                disabled={!v.in_stock}
                onClick={() => setVariantIdx(v.index)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${variantIdx === v.index ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-700 hover:border-slate-400'} ${!v.in_stock ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity + Add to Cart + Order Now */}
      {inStock ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Quantity</span>
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-300">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label="Decrease quantity"
                className="px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-sm font-semibold tabular-nums">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(lineCeiling(maxStock), q + 1))}
                disabled={qty >= lineCeiling(maxStock)}
                aria-label="Increase quantity"
                className="px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {maxStock != null && maxStock > 0 && maxStock <= 10 && (
              <span className="text-xs text-slate-500">Only {maxStock} left</span>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleAddToCart}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white px-6 py-3.5 text-base font-bold text-slate-900 transition hover:bg-slate-50"
            >
              {added ? <Check className="h-5 w-5 text-emerald-600" /> : <ShoppingCart className="h-5 w-5" />}
              {added ? 'Added to cart' : 'Add to Cart'}
            </button>
            <a
              href={checkoutHref}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-slate-800"
            >
              <ShoppingBag className="h-5 w-5" /> Order Now
            </a>
          </div>
        </div>
      ) : (
        <span className="flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 px-6 py-3.5 text-base font-bold text-slate-500">
          Out of Stock
        </span>
      )}
    </div>
  );
}

/* ── Share row ────────────────────────────────────────────────────────── */
function ShareRow({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => (typeof window !== 'undefined' ? window.location.href : '');

  const shareFb = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`, '_blank', 'noopener,width=640,height=640');
  const shareWa = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${name} ${url()}`)}`, '_blank', 'noopener');
  const copy = async () => {
    try { await navigator.clipboard.writeText(url()); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-2 border-y border-slate-100 py-4">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Share</span>
      <button type="button" onClick={shareFb} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <Facebook className="h-4 w-4 text-blue-600" /> Facebook
      </button>
      <button type="button" onClick={shareWa} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
      </button>
      <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4 text-slate-500" />}
        {copied ? 'Copied' : 'Copy Link'}
      </button>
    </div>
  );
}

/* ── Video embed helper ───────────────────────────────────────────────── */
/** Resolve a raw YouTube / Vimeo / direct-file URL into something renderable. */
function videoEmbed(raw: string): { type: 'iframe' | 'file' | 'link'; src: string } {
  const u = raw.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { type: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { type: 'iframe', src: `https://player.vimeo.com/video/${vm[1]}` };
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(u)) return { type: 'file', src: u };
  return { type: 'link', src: u };
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */
function ProductTabs({ product, meta }: { product: ProductDetail; meta: StorefrontMeta }) {
  // The "Galleries" tab shows the customer/lifestyle photos; the product's own
  // photos live in the buy-box gallery (ProductGallery, via gallery_urls).
  const customerGalleryUrls = (product.customer_gallery_urls ?? []).filter(Boolean);
  const reviews = product.reviews?.items ?? [];
  const faq = product.funnel?.faq ?? [];

  const phone = meta.whatsapp?.trim() || null;
  const phoneDigits = phone ? phone.replace(/\D/g, '') : '';
  const email = meta.email?.trim() || null;
  const video = product.video_url ? videoEmbed(product.video_url) : null;

  const tabs = [
    product.description_html ? { key: 'description', label: 'Description' } : null,
    product.specifications_html ? { key: 'specs', label: 'Specifications' } : null,
    customerGalleryUrls.length ? { key: 'galleries', label: 'Galleries' } : null,
    video ? { key: 'video', label: 'Video' } : null,
    reviews.length ? { key: 'reviews', label: 'Reviews' } : null,
    faq.length ? { key: 'faq', label: 'FAQ' } : null,
    product.support_info_html ? { key: 'support', label: 'Support' } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  const [active, setActive] = useState(tabs[0]?.key ?? 'description');
  if (tabs.length === 0) return <div />;

  return (
    // min-w-0: this is a grid/flex cell whose default min-width:auto would let a
    // wide spec table (long unbreakable token) push the whole page sideways on
    // mobile. min-w-0 lets it shrink to the column so the table wraps/scrolls.
    <div className="min-w-0 rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="flex flex-wrap gap-1 border-b border-slate-100 p-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${active === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Height-capped, internally-scrolling content (desktop) so a long
          description/spec table doesn't stretch the whole page — mirrors the
          reference's organized box. key={active} resets scroll on tab switch.
          On mobile it flows naturally (no nested scroll trap). */}
      <div key={active} className="p-5 sm:p-6 lg:max-h-[70vh] lg:min-h-[360px] lg:overflow-y-auto">
        {active === 'description' && product.description_html && (
          <div
            className="prose prose-sm max-w-none text-slate-600 prose-headings:text-slate-900 prose-a:text-brand-600 prose-table:text-sm"
            dangerouslySetInnerHTML={{ __html: product.description_html }}
          />
        )}

        {active === 'specs' && product.specifications_html && (
          <div
            className="prose prose-sm max-w-none text-slate-600 prose-headings:text-slate-900 prose-a:text-brand-600 prose-table:text-sm"
            dangerouslySetInnerHTML={{ __html: product.specifications_html }}
          />
        )}

        {active === 'video' && video && (
          video.type === 'iframe' ? (
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
              <iframe
                src={video.src}
                title={`${product.name} video`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          ) : video.type === 'file' ? (
            <video src={video.src} controls className="w-full rounded-xl bg-black" />
          ) : (
            <a
              href={video.src}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              ▶ Watch video
            </a>
          )
        )}

        {active === 'galleries' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {customerGalleryUrls.map((src, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                <img src={src} alt={`${product.name} — customer photo ${i + 1}`} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-2" />
              </div>
            ))}
          </div>
        )}

        {active === 'reviews' && (
          <div className="space-y-4">
            {reviews.slice(0, 10).map((r) => (
              <article key={r.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{r.author_name}</span>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">{r.body}</p>
              </article>
            ))}
          </div>
        )}

        {active === 'faq' && (
          <div className="space-y-4">
            {faq.map((f, i) => (
              <div key={i} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-semibold text-slate-900">{f.q}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        )}

        {active === 'support' && (
          <div className="space-y-5">
            {product.support_info_html && (
              <div
                className="prose prose-sm max-w-none text-slate-600 prose-headings:text-slate-900 prose-a:text-brand-600 prose-table:text-sm"
                dangerouslySetInnerHTML={{ __html: product.support_info_html }}
              />
            )}
            {(phone || email) && (
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-sm font-semibold text-slate-900">Need help with this product?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {phone && (
                    <a
                      href={`https://wa.me/${phoneDigits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  )}
                  {phone && (
                    <a
                      href={`tel:${phoneDigits}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      <Phone className="h-4 w-4 text-brand-600" /> Call
                    </a>
                  )}
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      <Mail className="h-4 w-4 text-slate-500" /> Email
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sidebar: You May Also Like + Quick Summary ───────────────────────── */
function Sidebar({
  product,
  meta,
  category,
}: {
  product: ProductDetail;
  meta: StorefrontMeta;
  category: { slug: string; name: string } | null;
}) {
  const related = (product.related_products ?? []).slice(0, 4);
  // Tenant's order/contact number drives both buttons. Hidden entirely when unset.
  const phone = meta.whatsapp?.trim() || null;
  const phoneDigits = phone ? phone.replace(/\D/g, '') : '';
  const waText = encodeURIComponent(`Hi, I'd like to order: ${product.name}`);

  return (
    <aside className="space-y-6">
      {related.length > 0 && (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
          <h2 className="mb-3 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">🎁 You May Also Like</h2>
          <div className="space-y-3">
            {related.map((p) => (
              <a key={p.slug} href={`/products/${p.slug}`} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-slate-50">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                  {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-1" />}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs font-semibold text-slate-900">{p.name}</p>
                  <p className="mt-0.5 text-sm font-bold text-brand-600">{formatBDT(p.price, { currency: meta.currency })}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
        <h2 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">Quick Summary</h2>

        {product.image_url && (
          <div className="relative my-4 aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-slate-100">
            <img src={product.image_url} alt={product.name} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-2" />
          </div>
        )}

        <dl className="divide-y divide-slate-100 text-sm">
          {product.brand && (
            <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-slate-500">Brand</dt><dd className="text-right font-semibold text-slate-900">{product.brand}</dd></div>
          )}
          {category && (
            <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-slate-500">Category</dt><dd className="text-right font-semibold text-slate-900">{category.name}</dd></div>
          )}
          <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-slate-500">Price</dt><dd className="text-right font-bold text-brand-600">{formatBDT(product.price, { currency: product.currency })}</dd></div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-slate-500">Stock</dt>
            <dd>
              {product.in_stock ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">In Stock</span>
              ) : (
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">Out of Stock</span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-slate-500">Warranty</dt><dd className="text-right font-semibold text-slate-900">{product.warranty || 'N/A'}</dd></div>
        </dl>

        {phone && (
          <div className="mt-4 space-y-2">
            <a
              href={`https://wa.me/${phoneDigits}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp Order
            </a>
            <a
              href={`tel:${phoneDigits}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
            >
              <Phone className="h-4 w-4 text-brand-600" /> Call Now
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
