import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { STOREFRONT_SLUG } from '../lib/api';

/**
 * Client-side multi-product cart (Phase 2).
 *
 * One order can contain many products, so the storefront keeps a cart in
 * localStorage and submits it as items[] at checkout. The store holds
 * DENORMALIZED line data (name, image, price, variant label) so the cart page
 * and the checkout Order Summary render without re-fetching products — the
 * server still re-prices and re-checks stock per line at submit, so a stale
 * client price/stock can never ship the wrong total or oversell.
 *
 * Slug-scoped like the auth token (`sf_cart_${slug}`) so two Reply.BD
 * storefronts on a shared device never cross-contaminate carts. SSR-safe:
 * there is no localStorage during Astro build or on the Cloudflare edge, so we
 * skip hydration on the server and rehydrate after mount (useCartHydrated) —
 * the same deferral the header uses for the auth token, which avoids a React
 * hydration mismatch between the static HTML (empty cart) and the client.
 */
export type CartLine = {
  product_id: number;
  slug: string;
  name: string;
  image_url: string | null;
  /** Positional variant identity (matches the API's variant_index); null = no variant. */
  variant_index: number | null;
  /** The shopper's specific choice WITHIN the row (size sub-picker for
   *  "M, L, XL" rows) — part of the line identity: two sizes of one row are
   *  different physical items. null/undefined = no choice (legacy lines from
   *  a persisted cart predating this field rehydrate as undefined). */
  variant_choice?: { size: string } | null;
  variant_label: string | null;
  unit_price: number;
  quantity: number;
  /** null = unlimited stock; a number caps the quantity. */
  max_stock: number | null;
  currency: string;
};

/** Everything needed to add a line except its quantity. */
export type AddCartInput = Omit<CartLine, 'quantity'>;

interface CartState {
  items: CartLine[];
  /** Add a line, or bump an existing (product_id, variant_index, choice) line's quantity. */
  addToCart: (line: AddCartInput, qty?: number) => void;
  removeFromCart: (productId: number, variantIndex: number | null, choice?: CartLine['variant_choice']) => void;
  setQty: (productId: number, variantIndex: number | null, qty: number, choice?: CartLine['variant_choice']) => void;
  clear: () => void;
}

/** The API caps a single product line at 20 units (StorefrontOrderController).
 *  Mirror it client-side so a stepper never builds a line the server rejects. */
export const MAX_LINE_QTY = 20;

/** Effective per-line ceiling: the lesser of tracked stock and MAX_LINE_QTY
 *  (null/0 stock = unlimited, so just the cap). Shared by every qty stepper. */
export const lineCeiling = (maxStock: number | null): number =>
  maxStock != null && maxStock > 0 ? Math.min(maxStock, MAX_LINE_QTY) : MAX_LINE_QTY;

/** Normalized identity of a line's size choice ('' = no choice). */
export const choiceKey = (c: CartLine['variant_choice']): string =>
  c?.size?.trim().toLowerCase() ?? '';

/** A cart line is identified by (product_id, variant_index, size choice). */
const sameLine = (
  l: CartLine,
  productId: number,
  variantIndex: number | null,
  choice: CartLine['variant_choice'],
): boolean =>
  l.product_id === productId &&
  (l.variant_index ?? null) === (variantIndex ?? null) &&
  choiceKey(l.variant_choice) === choiceKey(choice);

/** Clamp to >= 1 and <= the per-line ceiling (stock and the 20-unit cap). */
const clampQty = (qty: number, max: number | null): number =>
  Math.min(Math.max(1, Math.floor(qty)), lineCeiling(max));

// SSR-safe storage: no window/localStorage during build or on the edge.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const storage = createJSONStorage<{ items: CartLine[] }>(() =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
    ? window.localStorage
    : noopStorage,
);

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addToCart: (line, qty = 1) =>
        set((state) => {
          const exists = state.items.some((l) => sameLine(l, line.product_id, line.variant_index, line.variant_choice));
          if (exists) {
            return {
              items: state.items.map((l) =>
                sameLine(l, line.product_id, line.variant_index, line.variant_choice)
                  ? { ...l, ...line, quantity: clampQty(l.quantity + qty, line.max_stock) }
                  : l,
              ),
            };
          }
          return { items: [...state.items, { ...line, quantity: clampQty(qty, line.max_stock) }] };
        }),

      removeFromCart: (productId, variantIndex, choice = null) =>
        set((state) => ({
          items: state.items.filter((l) => !sameLine(l, productId, variantIndex, choice)),
        })),

      setQty: (productId, variantIndex, qty, choice = null) =>
        set((state) => ({
          items: state.items.map((l) =>
            sameLine(l, productId, variantIndex, choice) ? { ...l, quantity: clampQty(qty, l.max_stock) } : l,
          ),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: `sf_cart_${STOREFRONT_SLUG}`,
      storage,
      // Don't read localStorage during SSR/first render — rehydrate after mount.
      skipHydration: true,
    },
  ),
);

/** Total units in the cart. */
export const cartCount = (items: CartLine[]): number =>
  items.reduce((n, l) => n + l.quantity, 0);

/** Sum of line subtotals (display only — the server is the source of truth). */
export const cartSubtotal = (items: CartLine[]): number =>
  items.reduce((n, l) => n + l.unit_price * l.quantity, 0);

/**
 * Rehydrate the persisted cart once we're on the client, and report when it's
 * done. Cart-aware islands gate their first meaningful render on this so the
 * static (empty-cart) HTML and the hydrated client agree — no flash, no
 * hydration error. Safe to call from multiple islands; rehydrate() is idempotent.
 */
export function useCartHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useCart.persist.onFinishHydration(() => setHydrated(true));
    void useCart.persist.rehydrate();
    if (useCart.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}
