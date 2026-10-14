import { useEffect, useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { CreditCard, Truck, Wallet } from 'lucide-react';
import type { CreateOrderInput, PaymentMethod, StorefrontMeta } from '../../lib/types';
import { BD_DISTRICTS } from '../../lib/districts';
import { formatBDT } from '../../lib/format';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { WhatsAppIcon } from '../layout/messenger-cta';

/**
 * Shared checkout extras used by BOTH the storefront checkout and the funnel
 * order form:
 *
 *  - জেলা (district, native <datalist> type-ahead — free text allowed) +
 *    থানা fields, rendered only when the tenant opted in
 *    (meta.checkout.district_enabled);
 *  - the প্রবাসী shopper's optional WhatsApp number
 *    (meta.checkout.whatsapp_enabled) — ExpatWhatsAppField;
 *  - the advance-payment box: amount to send now, the tenant's wallet
 *    numbers VERBATIM from the API (never reformatted), and the optional
 *    "sender last-4" field. COD only — the caller hides it for the online
 *    methods, which collect their money at the gateway;
 *  - the payment-method picker: whichever of Cash on Delivery / Pay Online /
 *    Pay Advance Online the store offers (meta.payment_methods — COD is NOT
 *    guaranteed), plus the small helpers both forms need to keep the selected
 *    method valid and to send it.
 *
 * The displayed amounts mirror the server rule (delivery charge + extra at/
 * over the threshold, on the SUBTOTAL) for display only — the authoritative
 * advance / gateway charge is stamped server-side at order creation.
 */

/** The flat-amount + threshold-extra rule shared by the manual wallet advance
 *  (meta.advance_payment) and the gateway advance (meta.online_advance). */
type AdvanceRule = { delivery_charge: number; threshold: number | null; extra_amount: number };

export function advanceAmountFor(advance: AdvanceRule, subtotal: number): number {
  const extra =
    advance.threshold !== null && advance.extra_amount > 0 && subtotal >= advance.threshold
      ? advance.extra_amount
      : 0;
  return advance.delivery_charge + extra;
}

// ── Payment method ───────────────────────────────────────────────────────

const KNOWN_PAYMENT_METHODS: readonly PaymentMethod[] = ['cod', 'online', 'online_advance'];

export function isOnlineMethod(method: string | null | undefined): boolean {
  return method === 'online' || method === 'online_advance';
}

/**
 * The methods this store offers, in the server's order. Values this build
 * doesn't know are dropped; a payload that predates the field (or carries
 * nothing usable) means the legacy COD-only store.
 */
export function offeredPaymentMethods(meta: Pick<StorefrontMeta, 'payment_methods'> | null | undefined): PaymentMethod[] {
  const raw = meta?.payment_methods;
  if (!Array.isArray(raw)) return ['cod'];
  const known = raw.filter((m): m is PaymentMethod => (KNOWN_PAYMENT_METHODS as readonly string[]).includes(m));
  return known.length ? known : ['cod'];
}

/**
 * What the gateway charges up front for 'online_advance' on this cart: the
 * advance rule on the SUBTOTAL, never more than the order total. 0 = the rule
 * owes nothing for this cart (or the store doesn't offer the method).
 */
export function onlineAdvanceAmountFor(
  meta: Pick<StorefrontMeta, 'online_advance'> | null | undefined,
  subtotal: number,
  total: number,
): number {
  const rule = meta?.online_advance;
  if (!rule) return 0;
  return Math.max(0, Math.min(advanceAmountFor(rule, subtotal), total));
}

/**
 * The methods offerable for THIS cart: the store's set, minus the gateway
 * advance when
 *  - its rule owes nothing at this subtotal (a threshold-only rule under the
 *    threshold) — the server rejects it there too; or
 *  - it would cover the whole order while plain "Pay Online" is offered as
 *    well (a small cart against a flat advance) — the same choice shown
 *    twice. That needs the order `total`; a caller that passes none skips it.
 * If that would leave nothing, the full set is returned and the server has
 * the last word.
 *
 * `exclude` = the methods the order API has just refused for this cart (see
 * paymentRefusalNotice), taken out LAST — and by the same rule: were that to
 * leave nothing, they stay and the server has the last word.
 */
export function paymentMethodsForCart(
  meta: Pick<StorefrontMeta, 'payment_methods' | 'online_advance'> | null | undefined,
  subtotal: number,
  total?: number,
  exclude: PaymentMethod[] = [],
): PaymentMethod[] {
  const offered = offeredPaymentMethods(meta);
  const rule = meta?.online_advance ?? null;
  const advance = rule ? advanceAmountFor(rule, subtotal) : 0;
  const sameAsFull = total !== undefined && advance >= total && offered.includes('online');
  const usable = offered.filter((m) => m !== 'online_advance' || (advance > 0 && !sameAsFull));
  const forCart = usable.length ? usable : offered;
  const left = forCart.filter((m) => !exclude.includes(m));
  return left.length ? left : forCart;
}

/** Does this store take Cash on Delivery at all? */
export function codOffered(meta: Pick<StorefrontMeta, 'payment_methods'> | null | undefined): boolean {
  return offeredPaymentMethods(meta).includes('cod');
}

/**
 * The funnel builder's STOCK order-form heading and trust badge were written
 * when every store was Cash on Delivery. On a store that has switched COD off
 * they are wrong by default — so that stock text (and only it: anything the
 * tenant wrote themselves is theirs to keep) is treated as "no custom copy".
 * The value is the builder's constrained inline HTML.
 */
const STOCK_COD_COPY = ['order now — cash on delivery', 'cash on delivery'];

export function isStockCodCopy(html: string | null | undefined): boolean {
  const text = (html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;|&#8212;|&#x2014;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return STOCK_COD_COPY.includes(text);
}

/** Does the gateway advance for this cart amount to the whole order? */
export function onlineAdvanceCoversOrder(
  meta: Pick<StorefrontMeta, 'online_advance'> | null | undefined,
  subtotal: number,
  total: number,
): boolean {
  const amount = onlineAdvanceAmountFor(meta, subtotal, total);
  return amount > 0 && amount >= total;
}

/**
 * The method the form should treat as selected: the shopper's pick while it
 * is still offered for this cart, else the first offered one. Derived (not an
 * effect) so a pick that stops being offerable — qty drops under the advance
 * threshold — can never be submitted from a radio that is no longer on screen.
 *
 * One pick has a nearer neighbour than "the first one": an advance radio that
 * left the screen because, for this cart, the advance IS the whole order
 * (`advanceCoversOrder`) was a choice to pay online — it resolves to
 * 'online', never silently to Cash on Delivery.
 */
export function resolvePaymentMethod(
  picked: PaymentMethod | null,
  methods: PaymentMethod[],
  advanceCoversOrder = false,
): PaymentMethod {
  if (picked && methods.includes(picked)) return picked;
  if (picked === 'online_advance' && advanceCoversOrder && methods.includes('online')) return 'online';
  return methods[0] ?? 'cod';
}

/**
 * The note the CART checkout leaves (localStorage) before handing the shopper
 * to the gateway: this browser's cart built the order, so the order page
 * empties the cart once the payment confirms. A positive note in the cart's
 * own store, on purpose:
 *  - the gateway return routinely lands in another TAB (wallet app-switch,
 *    "Open in Chrome") — a tab-scoped sessionStorage note is not there;
 *  - a funnel / buy-now order never touched the cart and leaves no note, and
 *    neither does an order looked up from another browser — confirming those
 *    can never empty an unrelated cart.
 * A lost note (storage blocked) only leaves the cart badge lingering.
 */
export function payCartKey(orderNumber: string): string {
  return `replybd:pay-cart:${orderNumber}`;
}

/** Consume the note: true exactly once, and only in a browser that left it. */
export function takePayCartNote(orderNumber: string, storage: Pick<Storage, 'getItem' | 'removeItem'>): boolean {
  const key = payCartKey(orderNumber);
  if (!storage.getItem(key)) return false;
  storage.removeItem(key);
  return true;
}

/**
 * The note BOTH order forms leave (localStorage — the gateway return lands in
 * another tab as often as not, same reason as payCartKey) before handing the
 * shopper to the gateway: the page they ordered from, so the order page can
 * offer "Try again" when the payment does not go through. A path + query only
 * (utm / fbclid ride along) — never a name, a phone or an address.
 *
 * The stored string is NEVER used as a link: readPayReturnNote re-parses it,
 * keeps it only while it is a fresh, same-origin path that is not an order
 * page, and hands back the re-serialised pathname + search. A foreign,
 * malformed or expired note is deleted and yields no link.
 */
export const PAY_RETURN_TTL_MS = 24 * 60 * 60 * 1000;
const PAY_RETURN_PREFIX = 'replybd:pay-return:';
/** Longest path + query worth keeping — an ad URL runs to a few hundred chars. */
const PAY_RETURN_MAX_LENGTH = 2000;

export function payReturnKey(orderNumber: string): string {
  return `${PAY_RETURN_PREFIX}${orderNumber}`;
}

/** A site-relative path: ONE leading slash — never `//host` or `/\host`,
 *  which a browser reads as another site. */
function isLocalPath(path: string): boolean {
  return /^\/(?![/\\])/.test(path);
}

/** The order pages are never a place to "try again" from (the link would
 *  lead straight back to the page it is on). */
function isOrderPath(pathname: string): boolean {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    /* a stray % — judge the raw path */
  }
  return /^\/order(\/|$)/i.test(path);
}

/** The stamp of a stored note, or null when it is malformed or older than
 *  the TTL (a stamp from the future by more than the TTL is no better). */
function payReturnNoteOf(raw: string, now: number): { p: string; t: number } | null {
  let note: { p?: unknown; t?: unknown } | null = null;
  try {
    note = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!note || typeof note.p !== 'string' || typeof note.t !== 'number' || !Number.isFinite(note.t)) return null;
  if (Math.abs(now - note.t) > PAY_RETURN_TTL_MS) return null;
  return { p: note.p, t: note.t };
}

/**
 * Leave the note for this order. Never throws: blocked or full storage only
 * means the order page offers no "Try again". Notes of earlier attempts that
 * have outlived the TTL are swept here — nothing else removes an abandoned one.
 */
export function leavePayReturnNote(
  orderNumber: string,
  location: Pick<Location, 'pathname' | 'search'>,
  storage: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>,
  now: number,
): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(PAY_RETURN_PREFIX)) continue;
      if (!payReturnNoteOf(storage.getItem(key) ?? '', now)) stale.push(key);
    }
    stale.forEach((key) => storage.removeItem(key));
  } catch {
    /* a sweep that cannot run must not cost this order its note */
  }
  try {
    const path = location.pathname + location.search;
    if (path.length > PAY_RETURN_MAX_LENGTH || !isLocalPath(path) || isOrderPath(location.pathname)) return;
    storage.setItem(payReturnKey(orderNumber), JSON.stringify({ p: path, t: now }));
  } catch {
    /* storage blocked / full */
  }
}

/**
 * The path to send the shopper back to, or null. NOT consumed: Back from the
 * retry must still find it (a retry leaves its own note under the new order
 * number). `origin` is the page's own (window.location.origin).
 */
export function readPayReturnNote(
  orderNumber: string,
  origin: string,
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  now: number,
): string | null {
  try {
    const key = payReturnKey(orderNumber);
    const raw = storage.getItem(key);
    if (raw === null) return null;
    let path: string | null = null;
    const note = payReturnNoteOf(raw, now);
    if (note && note.p.length <= PAY_RETURN_MAX_LENGTH && isLocalPath(note.p)) {
      try {
        const url = new URL(note.p, origin);
        const local = url.pathname + url.search;
        // Checked again AFTER the parse: "/.//host" is same-origin going in
        // and re-serialises to "//host".
        if (url.origin === origin && isLocalPath(local) && !isOrderPath(url.pathname)) path = local;
      } catch {
        /* not a URL */
      }
    }
    if (path === null) storage.removeItem(key);
    return path;
  } catch {
    return null;
  }
}

export function clearPayReturnNote(orderNumber: string, storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(payReturnKey(orderNumber));
  } catch {
    /* storage blocked */
  }
}

/** The "Try again" link for a return path. The checkout page IS the form; a
 *  funnel's order form sits far down its landing page, so land on it. */
export function payRetryHref(returnPath: string): string {
  const pathname = returnPath.split('?')[0].replace(/\/+$/, '');
  return pathname === '/checkout' ? returnPath : `${returnPath}#funnel-order`;
}

/**
 * Said beside every "Try again". The link is a plain navigation to the page
 * the order was placed from — a fresh form, nothing carried over (by design:
 * no name, phone or address is kept anywhere to prefill it). That also means
 * a funnel is back on its default pack, quantity 1 and the first delivery
 * area, and a buy-now checkout on the quantity in its URL: "Try again" is a
 * new order, not a second go at the failed one, and the shopper has to look
 * at what it is for before paying.
 */
export const PAY_RETRY_FRESH_NOTE =
  'The order form opens fresh — please check the items, quantity and delivery area again before you pay.';

/**
 * What the gateway return URL says happened (/order/{n}?payment=…): the four
 * values the API and the gateways send, else null. An UNTRUSTED hint — it
 * never decides what happened to the payment (the order data does that). It
 * shapes the "Try again" offer (payRetryOffer) and, on a cancelled unpaid
 * order, whether the page looks for a late payment before it says "not
 * charged" (payLateCheck).
 *  - 'success'  the gateway sent the shopper back as paid;
 *  - 'pending'  the API could not learn a verdict yet (the money may be taken);
 *  - 'fail' / 'cancel'  the gateway sent the shopper back unpaid.
 */
export type PayReturnHint = 'success' | 'pending' | 'fail' | 'cancel';

export function payReturnHint(search: string): PayReturnHint | null {
  try {
    const hint = new URLSearchParams(search).get('payment');
    return hint === 'success' || hint === 'pending' || hint === 'fail' || hint === 'cancel' ? hint : null;
  } catch {
    return null;
  }
}

/**
 * Whether — and how — the order page offers the way back to the order form:
 *  - 'failed'      the order was cancelled unpaid. The primary action.
 *  - 'unfinished'  the order did not go through, but a payment for it cannot
 *                  be ruled out: it still awaits its payment, or it was
 *                  cancelled and the gateway's return says a payment may have
 *                  been made (payLateCheck 'not_found'). A quiet link, worded
 *                  for the shopper who did NOT pay — a retry from here is a
 *                  second payable order (for an awaiting one, once the API's
 *                  dedup window has passed).
 *  - null          no link.
 *
 * While the order is awaiting, the return hint is used in the safe direction
 * only. 'success' / 'pending' HIDE the link for as long as the order awaits —
 * the gateway took the money, or may have, and only our confirmation is late
 * (a slow IPN, a status pull that could not be made): offering "Try again"
 * there is how a shopper pays twice. 'fail' / 'cancel' show it at once (a
 * push-IPN gateway's fail / cancel return leaves the order awaiting, so
 * waiting for "cancelled" would strand that shopper on the spinner). With no
 * hint at all it appears once the status polls have run out.
 *
 * The same holds for an order that is already CANCELLED when such a return
 * arrives (payLateCheck): no link while the page is looking for that payment,
 * the quiet one once it has looked and found nothing — never the primary one
 * on that return. Every other cancelled, unpaid order: 'failed'.
 */
export function payRetryOffer(o: {
  /** A vetted return path exists (readPayReturnNote). */
  hasLink: boolean;
  paymentFailed: boolean;
  awaitingPayment: boolean;
  pollsExhausted: boolean;
  hint: PayReturnHint | null;
  /** payLateCheck's answer for this order. */
  late: PayLateState;
}): 'failed' | 'unfinished' | null {
  if (!o.hasLink) return null;
  if (o.paymentFailed) return o.late === null ? 'failed' : o.late === 'checking' ? null : 'unfinished';
  if (!o.awaitingPayment) return null;
  if (o.hint === 'success' || o.hint === 'pending') return null;
  if (o.hint === 'fail' || o.hint === 'cancel') return 'unfinished';
  return o.pollsExhausted ? 'unfinished' : null;
}

/**
 * How old (from its placing) a cancelled order can be and still have been
 * "just paid" on a gateway return — the API's own verify window at its
 * default (replybd: PaymentManager::verifyWindowMinutes(), 48 h). Raise the
 * two together. See payLateCheck.
 */
export const PAY_LATE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export type PayLateState = 'checking' | 'not_found' | null;

/**
 * A cancelled, uncharged order whose gateway return says the money was — or
 * may have been — taken ('success' / 'pending'). The shopper may have paid the
 * gateway page AFTER the order was given up (it timed out, or they went back
 * and chose another payment method) and reached this page before our
 * confirmation did. Telling them "you have not been charged — try again" is
 * wrong in the one way that costs money, so on that return the order page is
 *  - 'checking'   refetching while the status polls last. One ladder per
 *                 gateway return: the page notes when it began
 *                 (payLateCheckedKey) and a reload picks the ladder up where
 *                 the clock says it is (payPollsSpent) — it neither starts
 *                 over (the guest lookup is limited per IP) nor gives up
 *                 early. Only the gateway sending the shopper back AGAIN
 *                 begins another (payLateLadder);
 *  - 'not_found'  done looking, nothing recorded: it says a payment is not
 *                 confirmed — never "not charged" — and offers only the quiet
 *                 way back (payRetryOffer).
 * null = any other order, an ordinary cancelled one included.
 *
 * `toldInThisTab`: the tab has been on such a return for this order. It
 * stands in for a hint the URL no longer carries (the order re-opened from
 * "My Orders" or the tracking form) — never against a hint that is there: a
 * later 'fail' / 'cancel' return is the API's newer word. It is not forgotten
 * on that return, though: the next hint-less visit reads "not confirmed"
 * again. The API's 'fail' can be no more than the gateway's cancel URL with
 * nobody to ask, and the careful line costs the shopper nothing.
 *
 * The API answers 'pending' for such a return only while the order's gateway
 * session can still be alive (its verify window). The URL outlives that — a
 * bookmark, a restored tab — so the same bound is applied here to the order's
 * own age. An order with no readable date is taken at the API's word, and so
 * is one this browser placed within the day (`placedHere`, the return note):
 * its age is then known by this device's own clock, and comparing that clock
 * with the server's `placed_at` would only let a wrongly set phone switch the
 * check off — on exactly the page that offers the primary "Try again".
 */
export function payLateCheck(o: {
  paymentFailed: boolean;
  hint: PayReturnHint | null;
  /** This tab has already been told a payment may have been made on the order. */
  toldInThisTab: boolean;
  /** The order's `placed_at` (ISO 8601); null / unreadable = age unknown. */
  placedAt: string | null | undefined;
  /** Epoch ms. */
  now: number;
  /** This browser left for the gateway with the order within the day (a return note exists). */
  placedHere: boolean;
  pollsExhausted: boolean;
}): PayLateState {
  if (!o.paymentFailed) return null;
  const mayBePaid = o.hint === 'success' || o.hint === 'pending' || (o.hint === null && o.toldInThisTab);
  if (!mayBePaid) return null;
  if (!o.placedHere) {
    const placed = o.placedAt ? Date.parse(o.placedAt) : NaN;
    if (Number.isFinite(placed) && o.now - placed > PAY_LATE_MAX_AGE_MS) return null;
  }
  return o.pollsExhausted ? 'not_found' : 'checking';
}

/** sessionStorage: this tab's payLateCheck for the order — see PayLateStamp. */
export function payLateCheckedKey(orderNumber: string): string {
  return `replybd:pay-latecheck:${orderNumber}`;
}

/** How many poll ladders one tab runs on one order's late-payment check, at most. */
export const PAY_LATE_MAX_LADDERS = 3;

/** The note under payLateCheckedKey: when the tab's current ladder began (epoch ms) and which one it is (1 = the first). */
export type PayLateStamp = { at: number; n: number };

export function serializePayLateStamp(stamp: PayLateStamp): string {
  return `${stamp.at}:${stamp.n}`;
}

/** The stored stamp — null for none, or anything this code could not have written. */
export function readPayLateStamp(raw: string | null): PayLateStamp | null {
  const m = raw === null ? null : /^(\d{1,16}):(\d{1,2})$/.exec(raw);
  if (!m) return null;
  const at = Number(m[1]);
  const n = Number(m[2]);
  return at > 0 && n >= 1 ? { at, n } : null;
}

/**
 * How the page was entered: 'navigate' = a fresh arrival (a link, a redirect
 * — the gateway sending the shopper back); 'other' = a reload, Back / Forward,
 * a restored tab, or a browser that cannot say.
 */
export type PayArrival = 'navigate' | 'other';

export function payArrival(perf: unknown): PayArrival {
  try {
    const p = perf as
      | { getEntriesByType?: (type: string) => unknown; navigation?: { type?: unknown } | null }
      | null
      | undefined;
    const entries = p?.getEntriesByType?.('navigation');
    const entry = Array.isArray(entries) ? (entries[0] as { type?: unknown } | undefined) : undefined;
    if (entry && typeof entry.type === 'string') return entry.type === 'navigate' ? 'navigate' : 'other';
    // Older WebKit: only the deprecated performance.navigation (0 = navigate).
    return p?.navigation?.type === 0 ? 'navigate' : 'other';
  } catch {
    return 'other';
  }
}

/**
 * Where this page load stands in the tab's late-payment check for the order:
 * `startedAt` = when the ladder it continues began (null = this load begins
 * one, if the check runs at all); `ladders` = how many the tab has begun.
 *
 * A reload, a restored tab or Back / Forward continues the ladder the stamp
 * names — the hint stays in the address bar, and running the polls again on
 * every reload would spend the lookup's per-IP limit. A FRESH arrival on a
 * return that says a payment may have been made is another event: the
 * gateway has sent the shopper back again (they went back to its page and
 * paid, say), and that return is watched like the first — its own ladder,
 * not the tail of a spent one. At most PAY_LATE_MAX_LADDERS per tab and
 * order; after that, and for a browser that cannot tell a reload from an
 * arrival, the stamp's ladder stands.
 */
export function payLateLadder(o: {
  stamp: PayLateStamp | null;
  hint: PayReturnHint | null;
  arrival: PayArrival;
}): { startedAt: number | null; ladders: number } {
  if (o.stamp === null) return { startedAt: null, ladders: 0 };
  const again =
    o.arrival === 'navigate' && (o.hint === 'success' || o.hint === 'pending') && o.stamp.n < PAY_LATE_MAX_LADDERS;
  return { startedAt: again ? null : o.stamp.at, ladders: o.stamp.n };
}

/**
 * How many slots of a poll ladder (`delays`: ms before each poll) have gone
 * by, `elapsedMs` after it began — where a reloaded page takes the ladder up
 * again. A clock that went backwards starts it over (bounded all the same:
 * one ladder is all a page load ever runs).
 */
export function payPollsSpent(delays: readonly number[], elapsedMs: number): number {
  if (!(elapsedMs > 0)) return 0;
  let spent = 0;
  let at = 0;
  for (const delay of delays) {
    at += delay;
    if (at > elapsedMs) break;
    spent++;
  }
  return spent;
}

/**
 * The order API's 409 for a cart whose earlier ONLINE order may still be paid
 * ("your earlier online payment is still being checked"), given to a submit
 * with ANOTHER payment method: nothing was placed, nothing was cancelled, and
 * the same press is answered the same way until the API has its verdict or
 * its short hold runs out. Every press — a refused one too — counts against
 * the order form's rate limit (five an hour per phone), so both forms lock
 * the order button for as long as the API asks (`error.retry_after`, seconds)
 * instead of letting a shopper spend their submits on a wait.
 */
export const PAY_UNRESOLVED_CODE = 'payment_unresolved';
/** What an API that predates `retry_after` asked for in words: "a minute". */
export const PAY_WAIT_DEFAULT_S = 60;
/** The longest lock one response (or one stored value) can ask for. */
export const PAY_WAIT_MAX_S = 300;
export const PAY_WAIT_NOTE =
  'Your earlier online payment for this order is still being checked, so no new order was placed. You can order this way when the timer ends — or choose the payment method you started with to finish paying.';

/** Seconds to lock the order button after this refusal — 0 for any other. */
export function payWaitSeconds(code: string | undefined, retryAfter: number | undefined): number {
  if (code !== PAY_UNRESOLVED_CODE) return 0;
  const asked =
    typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.ceil(retryAfter)
      : PAY_WAIT_DEFAULT_S;
  return Math.min(asked, PAY_WAIT_MAX_S);
}

/**
 * A lock: when it ends (epoch ms), the payment methods the API refused, and
 * the page it was given on. It holds exactly the presses the API would refuse
 * again — the SAME form with a refused method. The method the shopper started
 * with stays live (that press is answered with their own order and a fresh
 * pay link), and so does every other order form.
 */
export type PayWait = { until: number; methods: PaymentMethod[]; page: string };

/** A form's identity for a lock: its path and query (the "Try again" link's hash is not part of it). */
export function payWaitPage(loc: { pathname: string; search: string }): string {
  return loc.pathname + loc.search;
}

export function serializePayWait(wait: PayWait): string {
  return JSON.stringify({ u: wait.until, m: wait.methods, p: wait.page });
}

/**
 * The stored lock, if it is this page's and still running — null for none,
 * another page's, a past one, and anything this code could not have written
 * (not that shape, or ending further off than the longest lock).
 */
export function readPayWait(raw: string | null, page: string, now: number): PayWait | null {
  if (raw === null) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const { u, m, p } = v as { u?: unknown; m?: unknown; p?: unknown };
  if (typeof u !== 'number' || !Number.isFinite(u) || p !== page || !Array.isArray(m)) return null;
  const left = u - now;
  if (!(left > 0 && left <= PAY_WAIT_MAX_S * 1000)) return null;
  const methods = m.filter((x): x is PaymentMethod => x === 'cod' || x === 'online' || x === 'online_advance');
  return methods.length > 0 ? { until: u, methods, page } : null;
}

/**
 * The lock after one more refusal on `page`: the refused methods add up, and
 * the LATER end stands (a lock from another page, or a spent one, is not
 * carried over). The API's hold is on the earlier order, not on a method —
 * one refusal that asks for a minute because the gateway could not be
 * reached does not end the two minutes another was told.
 */
export function payWaitWith(wait: PayWait | null, method: PaymentMethod, seconds: number, page: string, now: number): PayWait {
  const carried = wait !== null && wait.page === page && wait.until > now ? wait : null;
  const methods = carried ? carried.methods : [];
  return {
    until: Math.max(carried ? carried.until : 0, now + seconds * 1000),
    methods: methods.includes(method) ? methods : [...methods, method],
    page,
  };
}

/** 125 → "2:05". */
export function payWaitClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** sessionStorage: one entry per order form — a refusal on one form never replaces another form's lock. */
export function payWaitKey(page: string): string {
  return `replybd:pay-wait:${page}`;
}

/** The form a "Try again" link (payRetryHref) leads to, as that form's payWaitPage. */
export function payWaitPageOfHref(href: string): string {
  return href.split('#')[0];
}

/**
 * Lift the lock of the order form at `page`. The order page calls this once
 * it shows an online order that THIS browser took to the gateway from that
 * form (its return note) and that is no longer awaiting its payment — paid or
 * cancelled, the API would not answer "still being checked" for it again, and
 * "Try again" leads straight back there. Never for another order the tab
 * happens to show: the hold that lock stands for may still be running.
 */
export function clearPayWait(storage: Pick<Storage, 'removeItem'>, page: string): void {
  storage.removeItem(payWaitKey(page));
}

/**
 * The lock itself. `leftFor(method)` = whole seconds until the order button
 * is live again for that method (0 = live); `start(seconds, method)` locks it
 * after a refusal. Kept per tab in sessionStorage, so a reload does not hand
 * the button back early — and read again when the page comes back from the
 * bfcache, where the order page may have lifted it meanwhile (clearPayWait).
 * With storage blocked it simply lasts as long as the page.
 */
export function usePayWait(): {
  leftFor: (method: PaymentMethod) => number;
  start: (seconds: number, method: PaymentMethod) => void;
} {
  const [wait, setWait] = useState<PayWait | null>(null);
  const [left, setLeft] = useState(0);

  // After hydration (the server cannot know), and on a bfcache restore.
  useEffect(() => {
    const sync = () => {
      try {
        const now = Date.now();
        const page = payWaitPage(window.location);
        const stored = readPayWait(sessionStorage.getItem(payWaitKey(page)), page, now);
        setWait(stored);
        setLeft(stored ? Math.ceil((stored.until - now) / 1000) : 0);
      } catch {
        /* storage blocked — what the page holds stands */
      }
    };
    sync();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) sync();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  // Read off the clock on every tick, never counted down: a throttled
  // (background) tab still ends on time. An end further off than any lock —
  // the device clock was set back — ends it too.
  useEffect(() => {
    if (!wait) return;
    const tick = () => {
      const ms = wait.until - Date.now();
      if (ms > 0 && ms <= PAY_WAIT_MAX_S * 1000) {
        setLeft(Math.ceil(ms / 1000));
        return;
      }
      setLeft(0);
      setWait(null);
      try {
        sessionStorage.removeItem(payWaitKey(wait.page));
      } catch {
        /* storage blocked */
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [wait]);

  function start(seconds: number, method: PaymentMethod) {
    if (!(seconds > 0)) return;
    const next = payWaitWith(wait, method, seconds, payWaitPage(window.location), Date.now());
    setWait(next);
    setLeft(Math.ceil((next.until - Date.now()) / 1000));
    try {
      sessionStorage.setItem(payWaitKey(next.page), serializePayWait(next));
    } catch {
      /* storage blocked */
    }
  }

  return {
    leftFor: (method) => (wait !== null && wait.methods.includes(method) ? left : 0),
    start,
  };
}

/**
 * The gateway charge the server stamped on the order (`payment.amount`) when
 * it is NOT what the pay button promised — else null. The button's figure is
 * client maths (cart-stored prices, a client-side delivery fee, a meta that
 * can be a minute old); the server's is what the gateway will ask for, so a
 * difference is put to the shopper before the redirect, never sprung on them
 * at the gateway. Compared in whole paisa — float noise is not a difference —
 * and an API that predates the field (no number) has nothing to compare.
 */
export function payAmountChanged(promised: number, server: number | null | undefined): number | null {
  if (typeof server !== 'number' || !Number.isFinite(server)) return null;
  const paisa = Math.round(server * 100);
  return Math.abs(paisa - Math.round(promised * 100)) < 1 ? null : paisa / 100;
}

/**
 * Everything about an order AS SENT that the shopper sees and can change on
 * the form — who, where, what, how it is paid — as one comparable string.
 * Left out on purpose: the password (never kept anywhere), and what the
 * shopper does not choose (cart key, ad params, page URL, Turnstile token).
 *
 * The order API's own dedup identity is narrower — phone + items, for 90
 * seconds: a resubmit that changed only the address, the delivery area or a
 * note is answered with the FIRST order (`duplicate`). The forms compare this
 * to know when that happened (payPauseFor) and when nothing changed at all
 * (heldPauseFor).
 */
export function orderSubmitSignature(input: CreateOrderInput): string {
  const s = (v: string | null | undefined) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  return JSON.stringify([
    s(input.customer_name),
    s(input.customer_phone),
    s(input.customer_email),
    s(input.address),
    s(input.customer_city),
    s(input.thana),
    s(input.customer_whatsapp),
    s(input.advance_sender_last4),
    s(input.shipping_zone),
    s(input.notes),
    input.items.map((i) => [i.product_id, i.variant_index ?? null, s(i.variant?.size), i.quantity]),
    input.payment_method ?? null,
    input.create_account === true,
  ]);
}

/** A payment link held back for one tap, and what the box over it must say. */
export type PayPause = {
  url: string;
  orderNumber: string;
  /** What the gateway will ask for. */
  amount: number;
  /** An advance: what is then left to pay on delivery — the ORDER's total,
   *  as the server has it, less `amount`. null when the gateway takes the
   *  whole order. */
  rest: number | null;
  /** The order is one an EARLIER submit placed, and the form as it stands now
   *  is not — or cannot be shown to be — what it was placed with. */
  earlier: boolean;
};

/** The order this page itself placed, exactly as it was sent. */
export type PlacedOrder = { orderNumber: string; sig: string };

/**
 * Should the shopper see a box before the gateway — and which one? Three
 * reasons, all "the gateway is about to take money for something the screen
 * does not say":
 *
 *  - the charge the server stamped is not what the pay button promised
 *    (payAmountChanged);
 *  - an ADVANCE whose order total is not the one on screen. The picker told
 *    the shopper what is left for the door ("বাকি ৳500 ডেলিভারিতে") — the
 *    total less the advance — and the advance rule is all but flat: a price
 *    or delivery fee that moved changes the total and NOT the charge. The
 *    gateway would take exactly what the button said, for an order that then
 *    costs more at the door than the screen promised, with the advance
 *    already paid. (A full online payment needs no such check: there the
 *    charge IS the total. Cash on Delivery takes no money first.)
 *  - the server answered with an order an earlier submit placed (`duplicate`)
 *    and this page KNOWS it sent that one with other details (`placed`) — an
 *    address or delivery-area edit the dedup window swallowed.
 *
 * `earlier` picks the wording: true whenever the order is a replay that is
 * not provably the form as it stands, so the box never blames "updated
 * prices" for a difference the shopper's own edit made. A replay this page
 * cannot place (its first answer was lost) and whose figures match goes
 * straight on, as it always did. No number from the server → nothing to
 * compare and nothing to show → no box (an API that predates the field).
 */
export function payPauseFor(o: {
  url: string;
  orderNumber: string;
  duplicate: boolean;
  /** What the pay button promised. */
  promised: number;
  /** `payment.amount`, as the server sent it. */
  serverAmount: number | null | undefined;
  /** The order total the screen showed (what the picker's "rest on delivery"
   *  was worked out from). */
  promisedTotal: number;
  /** The order's total, as the server sent it. */
  orderTotal: number;
  method: PaymentMethod;
  /** orderSubmitSignature of what was just sent. */
  sig: string;
  placed: PlacedOrder | null;
}): PayPause | null {
  if (typeof o.serverAmount !== 'number' || !Number.isFinite(o.serverAmount)) return null;
  const mine = o.placed !== null && o.placed.orderNumber === o.orderNumber ? o.placed : null;
  const edited = o.duplicate && mine !== null && mine.sig !== o.sig;
  const changed = payAmountChanged(o.promised, o.serverAmount);
  const totalChanged = o.method === 'online_advance' && payAmountChanged(o.promisedTotal, o.orderTotal) !== null;
  if (changed === null && !edited && !totalChanged) return null;
  const amount = changed ?? Math.round(o.serverAmount * 100) / 100;
  // Whole paisa, like every comparison here — and no "rest" of a fraction of
  // one, or without a total to take it from.
  const restPaisa = o.method === 'online_advance' ? Math.round(o.orderTotal * 100) - Math.round(amount * 100) : 0;
  return {
    url: o.url,
    orderNumber: o.orderNumber,
    amount,
    rest: restPaisa > 0 ? restPaisa / 100 : null,
    earlier: o.duplicate && !(mine !== null && mine.sig === o.sig),
  };
}

/**
 * The pause box's sentence, around the amount: `lead` AMOUNT `tail`. The
 * rest of an advance is said as a figure — it is the one the picker's own
 * "rest on delivery" has to be read against.
 *
 * Both wordings end on what becomes of the order the box NAMES, because the
 * way out of the box (PAY_PAUSE_BACK_LABEL) cannot change it: the order
 * exists on the server, and whatever the shopper sends next either replays
 * it or is another order — it is never edited. Left unpaid it is cancelled by
 * the API's reaper; no time is given, that one is the API's to set. The
 * "earlier" wording says two minutes, not one: the API's dedup window is 90
 * seconds from the first placement, and a press inside it brings this same
 * box back.
 */
export function payPauseCopy(
  p: Pick<PayPause, 'orderNumber' | 'earlier' | 'rest'>,
  currency?: string,
): { lead: string; tail: string } {
  const rest = p.rest !== null ? ` The rest — ${formatBDT(p.rest, { currency })} — is paid on delivery.` : '';
  const it = p.orderNumber ? `order #${p.orderNumber}` : 'this order';
  if (p.earlier) {
    return {
      lead: `${p.orderNumber ? `Order #${p.orderNumber}` : 'This order'} was already placed a moment ago, as you first sent it — changes made since are not part of it. The amount to pay for it is`,
      tail: `.${rest} Continue to pay for it as it is, or wait two minutes and place the order again — ${it} is then left unpaid and is cancelled automatically.`,
    };
  }
  return {
    lead: `The amount to pay for ${it} is`,
    tail: ` (prices or delivery charges were updated).${rest} If you go back to the form instead, ${it} is not changed — left unpaid, it is cancelled automatically.`,
  };
}

/**
 * The way out of the pause box. It only hides the box (the link is kept —
 * heldPauseFor); it does not touch the order the box names, so it must not
 * say it does. It used to read "Change my order": a shopper who then lowered
 * the quantity placed a SECOND order while the first kept its stock.
 */
export const PAY_PAUSE_BACK_LABEL = 'Go back to the form';

/**
 * Is the shopper typing — is the focus in a control that takes text? The
 * pause box takes the focus when it appears (see the order forms), but never
 * out of a field: the text fields stay editable while an order is being sent,
 * and the next key must reach the field (where it drops the box, as any edit
 * does) rather than land on something it was not meant for.
 */
const NOT_TEXT_INPUTS = ['radio', 'checkbox', 'button', 'submit', 'reset', 'image', 'file', 'range', 'color', 'hidden'];

export function isTextEntry(
  el: { tagName?: string; type?: string | null; isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!el) return false;
  if (el.isContentEditable === true) return true;
  const tag = (el.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && !NOT_TEXT_INPUTS.includes((el.type ?? 'text').toLowerCase());
}

/** How long a held payment link is offered again without asking the server —
 *  well inside the hour after which the API's reaper cancels an unpaid order. */
export const PAY_PAUSE_REUSE_MS = 10 * 60 * 1000;

/** A pause the shopper stepped back from (PAY_PAUSE_BACK_LABEL), kept with the
 *  order it was for, how that order is paid and when the link was issued. */
export type HeldPay = { sig: string; at: number; method: PaymentMethod; pause: PayPause };

/**
 * Stepping back only hides the pause. Pressed again with NOTHING changed,
 * the pay button offers the same link — without a request. Asking the server
 * instead is right only inside its 90-second dedup window: after it the same
 * press places a second order beside the first (which keeps its stock until
 * the reaper), or is refused as out of stock by the shopper's own first order.
 * Anything changed, or the link too old → null: the server is asked.
 */
export function heldPauseFor(held: HeldPay | null, sig: string, now: number): PayPause | null {
  if (!held || held.sig !== sig) return null;
  const age = now - held.at;
  return age >= 0 && age < PAY_PAUSE_REUSE_MS ? held.pause : null;
}

/**
 * What is left of the held link once a request for `method` is about to leave
 * the page. Asking for the same cart with ANOTHER payment method is the one
 * request that makes the order API give the unpaid order up: it cancels it
 * and places the new one in a single transaction — and it has done so even
 * when the answer is lost on the way back, or is an error about the NEW order
 * (its gateway would not start). The held link still opens the gateway for
 * the cancelled order, and back on the first method the form's signature
 * matches it again: the box would offer that link without asking anyone, and
 * the money would land on a dead order. So it is dropped BEFORE the request,
 * whatever the answer turns out to be; an answer that carries a link for the
 * form as it stands arms a new one.
 *
 * The same method keeps it: that request can only replay the order or place
 * another beside it (other items, another phone) — the order the link pays
 * for is still waiting either way, and the link is the shopper's way back to
 * it when that request fails. Should the API ever give an unpaid order up for
 * anything else (an items or address edit), this must drop on that too.
 */
export function heldPayForSend(held: HeldPay | null, method: PaymentMethod): HeldPay | null {
  return held !== null && held.method === method ? held : null;
}

/** Shopper-facing error for a rejected / unstartable payment, never naming a
 *  method this store doesn't offer. */
export function paymentRetryHint(methods: PaymentMethod[]): string {
  return methods.includes('cod')
    ? 'We could not start the online payment. Please try again, or choose Cash on Delivery.'
    : 'We could not start the online payment. Please try again in a moment.';
}

/**
 * The order API's "that payment method is not on offer" answers (422): the
 * store's options changed under an open page, or — 'advance_unavailable' —
 * its advance rule asks for nothing on this cart. Both forms then re-read the
 * options (refreshPaymentMeta), take the refused method out of the picker and
 * say what changed. The order is NOT placed again for the shopper: they press
 * the button themselves, on a method they can see.
 */
export const PAYMENT_REFUSAL_CODES = ['cod_unavailable', 'online_unavailable', 'advance_unavailable'] as const;

export function isPaymentRefusal(code: string | null | undefined): boolean {
  return (PAYMENT_REFUSAL_CODES as readonly string[]).includes(code ?? '');
}

/** A method the order API refused, with the code it gave. */
export type PaymentRefusal = { method: PaymentMethod; code: string };

/**
 * Is this refusal about THIS cart rather than about the store? Only
 * 'advance_unavailable' is — the advance rule owes nothing at this subtotal,
 * and may owe something at another. 'cod_unavailable' / 'online_unavailable'
 * say what the store offers, whatever is in the cart.
 */
export function refusalEndsWithCart(code: string | null | undefined): boolean {
  return code === 'advance_unavailable';
}

/**
 * The refusals with one more recorded — one entry per method. A method the
 * STORE refused stays refused by the store even if a later answer is only
 * about the cart. Returns the same array when nothing changes.
 */
export function withPaymentRefusal(refusals: PaymentRefusal[], method: PaymentMethod, code: string): PaymentRefusal[] {
  const known = refusals.find((r) => r.method === method);
  if (!known) return [...refusals, { method, code }];
  if (refusalEndsWithCart(known.code) && !refusalEndsWithCart(code)) {
    return refusals.map((r) => (r === known ? { method, code } : r));
  }
  return refusals;
}

/**
 * The refusals still in force once the cart has changed: the store-level ones
 * for the life of the page — they are all that keeps a refused method off the
 * picker while the re-read options are themselves a minute stale — and the
 * cart-bound ones gone. Returns the same array when nothing was dropped.
 */
export function refusalsForNewCart(refusals: PaymentRefusal[]): PaymentRefusal[] {
  const kept = refusals.filter((r) => !refusalEndsWithCart(r.code));
  return kept.length === refusals.length ? refusals : kept;
}

/** A method, as a sentence names it — only ever one that is still on offer. */
const REFUSAL_NEXT_NAMES: Record<PaymentMethod, string> = {
  cod: 'Cash on Delivery',
  online: 'online payment',
  online_advance: 'an advance paid online',
};

/**
 * The notice for a refused method, given the methods the picker shows NOW
 * (re-read options, refused ones taken out). It says what went away, then
 * points only at what is still there — never at a method outside
 * `methodsNow` (same rule as paymentRetryHint). null = the picker could not
 * be changed (the refused method is still all there is to show): there is
 * nothing true to add, and the server's own message stands.
 *
 * `advanceReadsAsFull` = the gateway advance covers this whole order, which
 * the picker therefore titles "Pay Online" (see PaymentMethodPicker). Then
 *  - a refused 'online' leaves a picker that looks exactly as it did — the
 *    notice must not claim an option went away or that the options "have
 *    been updated"; it only asks the shopper to choose and press again;
 *  - the advance is named the way the picker names it.
 */
export function paymentRefusalNotice(
  code: string | null | undefined,
  refused: PaymentMethod,
  methodsNow: PaymentMethod[],
  advanceReadsAsFull = false,
): string | null {
  if (!methodsNow.length || methodsNow.includes(refused)) return null;
  const looksTheSame = refused === 'online' && advanceReadsAsFull && methodsNow.includes('online_advance');
  if (looksTheSame) {
    return methodsNow.length > 1
      ? 'We could not start that payment. Please choose one of the payment options below and place your order again.'
      : 'We could not start that payment. Please press the order button again.';
  }
  const gone =
    refused === 'cod'
      ? 'Cash on Delivery is no longer available at this store.'
      : code === 'advance_unavailable'
        ? 'This order does not need an advance payment.'
        : methodsNow.some(isOnlineMethod)
          ? 'That online payment option is no longer available at this store.'
          : 'Online payment is not available at this store right now.';
  const only = methodsNow[0];
  const next =
    methodsNow.length > 1
      ? 'The payment options below have been updated — please choose one and place your order again.'
      : `You can place this order with ${
          only === 'online_advance' && advanceReadsAsFull ? REFUSAL_NEXT_NAMES.online : REFUSAL_NEXT_NAMES[only]
        } instead — please press the order button again.`;
  return `${gone} ${next}`;
}

export function PaymentMethodPicker({
  name,
  methods,
  value,
  onChange,
  codHasAdvance,
  advanceAmount,
  total,
  currency,
  disabled = false,
}: {
  /** Radio group name — unique per form on the page. */
  name: string;
  methods: PaymentMethod[];
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  /** The choice is locked — an order with the method shown is being sent. */
  disabled?: boolean;
  /** A COD order at this subtotal carries a manual wallet advance. */
  codHasAdvance: boolean;
  /** Gateway advance for THIS cart (see onlineAdvanceAmountFor). */
  advanceAmount: number;
  total: number;
  currency: string;
}) {
  // An advance that covers the whole order is just "pay online".
  const advanceIsFull = advanceAmount >= total;
  const remaining = Math.max(0, total - advanceAmount);

  const copy = (method: PaymentMethod, only: boolean): { title: string; text: string } => {
    if (method === 'online' || (method === 'online_advance' && advanceIsFull)) {
      return {
        title: 'Pay Online',
        text: "bKash, Nagad, Rocket or card — you'll be taken to a secure payment page.",
      };
    }
    if (method === 'online_advance') {
      return {
        title: `Pay ${formatBDT(advanceAmount, { currency })} Advance Online`,
        text: `এখন ${formatBDT(advanceAmount, { currency })} অনলাইনে (bKash / Nagad / Rocket / কার্ড) — বাকি ${formatBDT(remaining, { currency })} ডেলিভারিতে।`,
      };
    }
    return {
      title: 'Cash on Delivery',
      text: codHasAdvance
        ? only
          ? 'অগ্রিম পাঠিয়ে অর্ডার কনফার্ম করুন — বাকি টাকা ডেলিভারিতে দেবেন।'
          : 'অগ্রিম পাঠিয়ে কনফার্ম — বাকি টাকা ডেলিভারিতে।'
        : 'Pay when your order arrives. No upfront payment needed.',
    };
  };
  const Icon = ({ method, className }: { method: PaymentMethod; className: string }) =>
    method === 'cod' ? <Truck className={className} /> : <CreditCard className={className} />;

  // One method → nothing to choose: a plain statement of how this store is paid.
  if (methods.length <= 1) {
    const only = methods[0] ?? 'cod';
    const c = copy(only, true);
    return (
      <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <Icon method={only} className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
        <div>
          <p className="text-sm font-semibold text-brand-900">{c.title}</p>
          <p className="text-xs text-brand-700">{c.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Method</p>
      {methods.map((method) => {
        const c = copy(method, false);
        const selected = value === method;
        return (
          <label
            key={method}
            className={`flex items-start gap-3 rounded-xl border p-4 transition ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${selected ? 'border-brand-500 bg-brand-50' : disabled ? 'border-slate-200' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <input
              type="radio"
              name={name}
              value={method}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(method)}
              className="mt-1 h-4 w-4 shrink-0 border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="flex items-start gap-3">
              <Icon method={method} className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{c.title}</span>
                <span className="block text-xs text-slate-500">{c.text}</span>
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * The প্রবাসী (expat) shopper's optional WhatsApp number — beside the
 * Bangladeshi phone (the parcel, the courier and SMS stay on that), never
 * instead of it. Rendered when the store asks for it
 * (meta.checkout.whatsapp_enabled): already open for a visitor Cloudflare
 * places outside Bangladesh, one tappable line for everyone else — a visitor
 * in Bangladesh, or one whose country is unknown. Never gated on the country:
 * an expat on a VPN, roaming or home on leave, and a relative ordering for
 * them, all see a Bangladeshi address. Once open it stays open, so nothing
 * typed into it can block the order button out of sight. The value is read
 * by src/lib/whatsapp.ts, which mirrors the API's rule.
 */
export function ExpatWhatsAppField({
  idPrefix,
  field,
  error,
  abroad,
}: {
  idPrefix: string;
  field: UseFormRegisterReturn;
  error?: string;
  /** The visitor is outside Bangladesh (known), so the field starts open. */
  abroad: boolean;
}) {
  const [open, setOpen] = useState(abroad);
  const id = `${idPrefix}-whatsapp`;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
      >
        <WhatsAppIcon className="h-4 w-4" />
        প্রবাসী? হোয়াটসঅ্যাপ নাম্বার দিন
      </button>
    );
  }

  return (
    <div>
      <Label htmlFor={id} className="flex items-center gap-1.5">
        <WhatsAppIcon className="h-4 w-4 text-emerald-600" />
        <span>
          প্রবাসী? হোয়াটসঅ্যাপ নাম্বার <span className="font-normal text-slate-400">(ঐচ্ছিক)</span>
        </span>
      </Label>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        // Not "tel": a browser would fill the Bangladeshi phone in here.
        autoComplete="off"
        placeholder="+971 50 123 4567"
        // Opened by a tap: the cursor goes where the shopper is about to type.
        autoFocus={!abroad}
        {...field}
        className="mt-1.5"
      />
      {error ? (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">দেশের কোডসহ লিখুন। ডেলিভারি হবে উপরের বাংলাদেশি নাম্বারে।</p>
      )}
    </div>
  );
}

export function DistrictThanaFields({
  idPrefix,
  districtField,
  thanaField,
}: {
  idPrefix: string;
  districtField: UseFormRegisterReturn;
  thanaField: UseFormRegisterReturn;
}) {
  const listId = `${idPrefix}-bd-districts`;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor={`${idPrefix}-district`}>জেলা</Label>
        <Input
          id={`${idPrefix}-district`}
          list={listId}
          placeholder="লিখুন বা বেছে নিন…"
          autoComplete="off"
          {...districtField}
          className="mt-1.5"
        />
        <datalist id={listId}>
          {BD_DISTRICTS.map((d) => (
            <option key={d.en} value={d.bn} label={d.en} />
          ))}
        </datalist>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-thana`}>থানা</Label>
        <Input id={`${idPrefix}-thana`} placeholder="যেমন: দেবিদ্বার" {...thanaField} className="mt-1.5" />
      </div>
    </div>
  );
}

export function AdvancePaymentBox({
  idPrefix,
  advance,
  subtotal,
  currency,
  last4Field,
  last4Error,
}: {
  idPrefix: string;
  advance: NonNullable<StorefrontMeta['advance_payment']>;
  subtotal: number;
  currency: string;
  last4Field: UseFormRegisterReturn;
  last4Error?: string;
}) {
  const amount = advanceAmountFor(advance, subtotal);
  if (amount <= 0) return null;

  const wallets: { key: string; label: string; number: string }[] = [
    advance.numbers.bkash ? { key: 'bkash', label: 'bKash', number: advance.numbers.bkash } : null,
    advance.numbers.nagad ? { key: 'nagad', label: 'Nagad', number: advance.numbers.nagad } : null,
    advance.numbers.rocket ? { key: 'rocket', label: 'Rocket', number: advance.numbers.rocket } : null,
  ].filter((w): w is { key: string; label: string; number: string } => w !== null);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
        <Wallet className="h-4 w-4 shrink-0" />
        অর্ডার কনফার্ম করতে অগ্রিম {formatBDT(amount, { currency })} পাঠান
      </p>
      <ul className="mt-2 space-y-1">
        {wallets.map((w) => (
          <li key={w.key} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-amber-100">
            <span className="text-xs font-semibold text-slate-700">{w.label} (Send Money)</span>
            {/* The number string straight from the API — selectable for easy copy. */}
            <span className="select-all font-mono text-sm font-bold tracking-wide text-slate-900">{w.number}</span>
          </li>
        ))}
      </ul>
      {advance.note && <p className="mt-2 text-xs text-amber-800">{advance.note}</p>}

      <div className="mt-3">
        <Label htmlFor={`${idPrefix}-adv-last4`} className="text-amber-900">
          আপনি যে নম্বর থেকে টাকা পাঠিয়েছেন বা পাঠাবেন, তার শেষের ৪ ডিজিট{' '}
          <span className="font-normal text-amber-700">(ঐচ্ছিক)</span>
        </Label>
        {/* Cap matches the server's max:32, NOT 4: shoppers routinely paste a
            full number despite the label, and the server keeps its last 4. A
            tighter cap would clip a spaced/hyphenated international number to
            the WRONG last 4 (e.g. "+880 1712-345678" → "…3456"), stranding
            auto-verify. */}
        <Input
          id={`${idPrefix}-adv-last4`}
          inputMode="numeric"
          maxLength={32}
          placeholder="যেমন: ৪৬৭১"
          autoComplete="off"
          {...last4Field}
          className="mt-1.5 bg-white"
        />
        {last4Error && <p className="mt-1 text-xs text-rose-600">{last4Error}</p>}
        <p className="mt-1.5 text-[11px] leading-relaxed text-amber-700">
          এখনই না পাঠালেও সমস্যা নেই — ডিজিটগুলো দিয়ে রাখুন, টাকা পৌঁছালে আমরা মিলিয়ে অর্ডার কনফার্ম করে দেব।
        </p>
      </div>
    </div>
  );
}
