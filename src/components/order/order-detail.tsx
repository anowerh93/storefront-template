import { formatBDT } from '../../lib/format';
import { customerStatus } from '../../lib/order-status';
import { Badge } from '../ui/badge';
import { OrderProgress } from './order-progress';
import type { OrderResponse, StorefrontMeta } from '../../lib/types';

/**
 * The order summary UI, shared by the guest tracking page (order-status.tsx,
 * looked up by phone last-4) and the logged-in account order view (looked up
 * via the bearer-token /customer/orders endpoint). Pure presentational — it
 * receives an already-fetched OrderResponse so the two surfaces can fetch it
 * however they need (guest lookup vs. authed).
 *
 * Layout: the order's progress as milestones with icons (<OrderProgress>:
 * Order placed → Confirmed → Shipped → Delivered), then an "Order Details" +
 * "Customer Details" pair, then an "Ordered Products" table with a totals
 * footer.
 */

/**
 * Variant → display string. The API sends `variant` as a string|null, but
 * defend against a stray object (an old build / cached payload that still
 * sends the raw {color,size,…} array) — rendering an object as a React child
 * throws and blanks the whole page. Only color/size/weight are surfaced, never
 * the internal stock count.
 */
function variantText(variant: unknown): string {
  if (typeof variant === 'string') return variant.trim();
  if (variant && typeof variant === 'object') {
    return ['color', 'size', 'weight']
      .map((k) => (variant as Record<string, unknown>)[k])
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .join(' · ');
  }
  return '';
}

/** How the order is paid, in the shopper's words. Unknown / absent → COD (an
 *  API that predates the field only ever had COD orders without it). An
 *  "advance" the gateway collects IN FULL (a small order against a flat
 *  advance — the picker called it "Pay Online") is simply an online payment:
 *  there is no cash part to name. */
export function paymentMethodLabel(
  order: Pick<OrderResponse, 'payment_method' | 'payment_status' | 'online_charge_amount' | 'total'>,
): string {
  const method = order.payment_method;
  if (method === 'online') return 'Online Payment';
  if (method === 'online_advance') {
    const inFull =
      order.payment_status === 'paid' ||
      (typeof order.online_charge_amount === 'number' && order.online_charge_amount >= order.total - 0.005);
    return inFull ? 'Online Payment' : 'Advance Online + Cash on Delivery';
  }
  return 'Cash on Delivery';
}

/** ISO → "19 Jun 2026" (absolute, locale-stable). Empty string when unusable. */
function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function OrderDetail({
  order,
  meta,
  phoneLast4,
}: {
  order: OrderResponse;
  /** Storefront meta — used to resolve the shipping-zone code to its label. */
  meta?: StorefrontMeta | null;
  /** Last 4 digits of the phone (from the success/lookup URL) → masked display. */
  phoneLast4?: string;
}) {
  // Customer-facing label + variant — deliberately NOT the API's status_label,
  // which is internal merchant jargon ("Pending (needs call)").
  const statusInfo = customerStatus(order.status);

  const currency = order.currency;
  const items = order.items ?? [];

  // What was paid through the gateway and what the rider still collects —
  // straight from the server, never derived from payment_status (a short or
  // review-parked payment is "paid" with a remainder). Both keys are absent
  // on an API that predates them, which simply hides the rows. "Due on
  // delivery" is only worth a row when it differs from the total (something
  // was prepaid) and the order is still going out — not cancelled, and not
  // already delivered (the rider collected it; nothing is due any more).
  const paidOnline = typeof order.online_paid_amount === 'number' ? order.online_paid_amount : 0;
  const dueOnDelivery =
    order.status !== 'canceled' &&
    order.status !== 'delivered' &&
    typeof order.due_on_delivery === 'number' &&
    Math.abs(order.due_on_delivery - order.total) >= 0.01
      ? order.due_on_delivery
      : null;
  // A manual wallet advance (bKash / Nagad / Rocket) the store recorded on the
  // order. The server already takes it off `due_on_delivery`, so without its
  // own row a COD order reads "Total 1000 / Due on Delivery 800" with nothing
  // accounting for the 200. It is money already received, so it shows whatever
  // the status — also delivered / cancelled, where the Due row is hidden. The
  // key is absent on an API that predates it (and 0 when there is none):
  // no row, the page exactly as before. Never folded into `paidOnline` — that
  // is gateway money, a separate ledger.
  const advancePaid =
    typeof order.advance_paid_amount === 'number' && order.advance_paid_amount > 0 ? order.advance_paid_amount : 0;

  // shipping_zone is a CODE ('inside_city'); turn it into the human label the
  // tenant configured. Null when shipping is off or no zone was chosen.
  const zoneLabel = order.shipping_zone
    ? (meta?.shipping?.zones?.find((z) => z.code === order.shipping_zone)?.label ?? null)
    : null;

  // We never receive the full phone (the guest lookup is last-4-gated for
  // privacy); show a masked 11-digit BD number when we have the last 4.
  const maskedPhone =
    phoneLast4 && /^\d{4}$/.test(phoneLast4) ? `01•••••${phoneLast4}` : null;

  const placedDate = formatDate(order.placed_at);

  return (
    <div className="space-y-6">
      {/* Where the order stands — milestones with icons (order-progress.tsx). */}
      <Card title="Order Progress">
        <OrderProgress order={order} />
      </Card>

      {/* Order Details + Customer Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Order Details">
          <Row label="Order Number" value={<span className="font-bold text-slate-900">{order.order_number}</span>} />
          <Row label="Status" value={<Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>} />
          {/* multiline: the advance label is wider than a phone's value column. */}
          <Row label="Payment Method" value={paymentMethodLabel(order)} multiline />
          {zoneLabel && <Row label="Shipping Method" value={zoneLabel} />}
          {placedDate && <Row label="Order Date" value={placedDate} />}
          <Row label="Total" value={<span className="font-bold text-slate-900">{formatBDT(order.total, { currency })}</span>} />
          {paidOnline > 0 && (
            <Row label="Paid Online" value={<span className="font-semibold text-emerald-700">{formatBDT(paidOnline, { currency })}</span>} />
          )}
          {advancePaid > 0 && (
            <Row label="Advance Paid" value={<span className="font-semibold text-emerald-700">{formatBDT(advancePaid, { currency })}</span>} />
          )}
          {dueOnDelivery !== null && (
            <Row label="Due on Delivery" value={<span className="font-bold text-slate-900">{formatBDT(dueOnDelivery, { currency })}</span>} />
          )}
        </Card>

        <Card title="Customer Details">
          {order.customer_name && <Row label="Name" value={order.customer_name} multiline />}
          {maskedPhone && <Row label="Phone" value={<span className="tabular-nums">{maskedPhone}</span>} />}
          {order.customer_email && <Row label="Email" value={order.customer_email} multiline />}
          {order.address && <Row label="Address" value={order.address} multiline />}
        </Card>
      </div>

      {/* Ordered Products */}
      <Card title="Ordered Products">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No items on this order.</p>
        ) : (
          <>
            {/* Table — sm and up */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2.5 pr-3">Product</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 pl-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-3">
                        <p className="font-medium text-slate-900">{it.product_name}</p>
                        {variantText(it.variant) && <p className="text-xs text-slate-500">{variantText(it.variant)}</p>}
                      </td>
                      <td className="py-3 px-3 text-center tabular-nums text-slate-700">{it.quantity}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-700">{formatBDT(it.unit_price, { currency })}</td>
                      <td className="py-3 pl-3 text-right font-semibold tabular-nums text-slate-900">{formatBDT(it.subtotal, { currency })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Stacked list — mobile */}
            <ul className="divide-y divide-slate-100 sm:hidden">
              {items.map((it, i) => (
                <li key={i} className="py-3">
                  <p className="font-medium text-slate-900">{it.product_name}</p>
                  {variantText(it.variant) && <p className="text-xs text-slate-500">{variantText(it.variant)}</p>}
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xs text-slate-500 tabular-nums">
                      Qty {it.quantity} × {formatBDT(it.unit_price, { currency })}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">{formatBDT(it.subtotal, { currency })}</span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Totals footer */}
            <div className="mt-4 ml-auto max-w-xs space-y-1.5 border-t border-slate-200 pt-4 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatBDT(order.subtotal, { currency })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="tabular-nums">{order.shipping_fee === 0 ? <span className="font-semibold text-brand-600">Free</span> : formatBDT(order.shipping_fee, { currency })}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900">
                <span>Total</span>
                <span className="tabular-nums">{formatBDT(order.total, { currency })}</span>
              </div>
              {paidOnline > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Paid online</span>
                  <span className="tabular-nums">− {formatBDT(paidOnline, { currency })}</span>
                </div>
              )}
              {advancePaid > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Advance paid</span>
                  <span className="tabular-nums">− {formatBDT(advancePaid, { currency })}</span>
                </div>
              )}
              {dueOnDelivery !== null && (
                <div className="flex items-baseline justify-between font-semibold text-slate-900">
                  <span>Due on delivery</span>
                  <span className="tabular-nums">{formatBDT(dueOnDelivery, { currency })}</span>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* A titled white panel. */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
      <h2 className="mb-4 border-b border-slate-100 pb-3 text-lg font-bold text-slate-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/* A label/value line. Values right-align (and may wrap when `multiline`). */
function Row({ label, value, multiline = false }: { label: string; value: React.ReactNode; multiline?: boolean }) {
  return (
    <div className={`flex gap-4 text-sm ${multiline ? 'items-start' : 'items-center'} justify-between`}>
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className={`text-right font-medium text-slate-900 ${multiline ? 'break-words' : 'truncate'}`}>{value}</span>
    </div>
  );
}
