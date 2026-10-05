import type { UseFormRegisterReturn } from 'react-hook-form';
import { CreditCard, Truck, Wallet } from 'lucide-react';
import type { PaymentMethod, StorefrontMeta } from '../../lib/types';
import { BD_DISTRICTS } from '../../lib/districts';
import { formatBDT } from '../../lib/format';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/**
 * Shared checkout extras used by BOTH the storefront checkout and the funnel
 * order form:
 *
 *  - জেলা (district, native <datalist> type-ahead — free text allowed) +
 *    থানা fields, rendered only when the tenant opted in
 *    (meta.checkout.district_enabled);
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
 */
export function paymentMethodsForCart(
  meta: Pick<StorefrontMeta, 'payment_methods' | 'online_advance'> | null | undefined,
  subtotal: number,
  total?: number,
): PaymentMethod[] {
  const offered = offeredPaymentMethods(meta);
  const rule = meta?.online_advance ?? null;
  const advance = rule ? advanceAmountFor(rule, subtotal) : 0;
  const sameAsFull = total !== undefined && advance >= total && offered.includes('online');
  const usable = offered.filter((m) => m !== 'online_advance' || (advance > 0 && !sameAsFull));
  return usable.length ? usable : offered;
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

/** Shopper-facing error for a rejected / unstartable payment, never naming a
 *  method this store doesn't offer. */
export function paymentRetryHint(methods: PaymentMethod[]): string {
  return methods.includes('cod')
    ? 'We could not start the online payment. Please try again, or choose Cash on Delivery.'
    : 'We could not start the online payment. Please try again in a moment.';
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
}: {
  /** Radio group name — unique per form on the page. */
  name: string;
  methods: PaymentMethod[];
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
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
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${selected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <input
              type="radio"
              name={name}
              value={method}
              checked={selected}
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
