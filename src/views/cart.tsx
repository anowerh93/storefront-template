import { Loader2, Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart, cartSubtotal, useCartHydrated, lineCeiling } from '../stores/cart';
import { formatBDT } from '../lib/format';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { Button } from '../components/ui/button';
import { FitImage } from '../components/ui/fit-image';
import { NotFoundPage } from './not-found';
import type { StorefrontMeta } from '../lib/types';

/**
 * The cart page — review lines, change quantities, remove, then proceed to a
 * multi-item checkout. The cart lives in localStorage (slug-scoped); we gate
 * the first meaningful render on hydration so the static HTML (empty) and the
 * client agree. "Proceed to Checkout" goes to /checkout with NO query params —
 * that's the signal for checkout's cart-mode (vs. the express ?p&v&q buy-now).
 */
export function CartPage({ meta }: { meta: StorefrontMeta | null }) {
  const hydrated = useCartHydrated();
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const removeFromCart = useCart((s) => s.removeFromCart);

  if (!meta) return <NotFoundPage />;

  const currency = meta.currency;
  const subtotal = cartSubtotal(items);

  return (
    <>
      <Header meta={meta} />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-slate-900">
          <ShoppingCart className="h-6 w-6 text-slate-500" /> Your Cart
        </h1>

        {!hydrated ? (
          <div className="py-20 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
            <p className="mt-4 text-sm text-slate-500">Loading your cart…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-slate-600">Your cart is empty.</p>
            <a href="/products" className="mt-5 inline-block">
              <Button variant="brand" size="lg">Start shopping</Button>
            </a>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
            {/* Lines */}
            <ul className="space-y-3">
              {items.map((l) => (
                <li
                  key={`${l.product_id}:${l.variant_index ?? '-'}`}
                  className="flex items-start gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                    {l.image_url && <FitImage src={l.image_url} alt={l.name} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <a href={`/products/${l.slug}`} className="font-semibold text-slate-900 hover:text-brand-600 line-clamp-2">
                      {l.name}
                    </a>
                    {l.variant_label && <p className="mt-0.5 text-xs text-slate-500">{l.variant_label}</p>}
                    <p className="mt-0.5 text-sm font-semibold text-rose-600">{formatBDT(l.unit_price, { currency })}</p>

                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center overflow-hidden rounded-lg border border-slate-300">
                        <button
                          type="button"
                          onClick={() => setQty(l.product_id, l.variant_index, l.quantity - 1)}
                          disabled={l.quantity <= 1}
                          aria-label="Decrease quantity"
                          className="px-2 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{l.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQty(l.product_id, l.variant_index, l.quantity + 1)}
                          disabled={l.quantity >= lineCeiling(l.max_stock)}
                          aria-label="Increase quantity"
                          className="px-2 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(l.product_id, l.variant_index)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>

                  <div className="shrink-0 text-right font-bold text-slate-900">
                    {formatBDT(l.unit_price * l.quantity, { currency })}
                  </div>
                </li>
              ))}
            </ul>

            {/* Summary */}
            <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 lg:sticky lg:top-6">
              <h2 className="border-b border-slate-100 pb-3 text-lg font-bold text-slate-900">Summary</h2>
              <div className="flex justify-between py-4 text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold text-slate-900">{formatBDT(subtotal, { currency })}</span>
              </div>
              <p className="mb-4 text-xs text-slate-500">Shipping is calculated at checkout.</p>
              <a href="/checkout" className="block">
                <Button variant="brand" size="lg" className="w-full">
                  <ShoppingCart className="h-4 w-4" /> Proceed to Checkout
                </Button>
              </a>
              <a href="/products" className="mt-3 block text-center text-sm font-medium text-slate-500 hover:text-brand-600">
                Continue shopping
              </a>
            </div>
          </div>
        )}
      </main>

      <Footer meta={meta} />
    </>
  );
}
