import { Check, X } from 'lucide-react';
import { formatBDT } from '../../lib/format';
import { customerStatus } from '../../lib/order-status';
import { Badge } from '../ui/badge';
import type { OrderResponse, StorefrontMeta } from '../../lib/types';

/**
 * The order summary UI, shared by the guest tracking page (order-status.tsx,
 * looked up by phone last-4) and the logged-in account order view (looked up
 * via the bearer-token /customer/orders endpoint). Pure presentational — it
 * receives an already-fetched OrderResponse so the two surfaces can fetch it
 * however they need (guest lookup vs. authed).
 *
 * Layout: a vertical status Timeline (Order placed → recorded milestones), then
 * an "Order Details" + "Customer Details" pair, then an "Ordered Products" table
 * with a totals footer.
 */

// Customer-facing copy for each timeline milestone. The API only ever sends
// these post-placement statuses (it filters internal verification states out),
// but we still guard by looking each one up so an unknown status is skipped.
const STEP_COPY: Record<string, { title: string; description: string; canceled?: boolean }> = {
  confirmed: { title: 'Confirmed', description: 'We’ve confirmed your order.' },
  shipped:   { title: 'Shipped',   description: 'Your order is on the way.' },
  delivered: { title: 'Delivered', description: 'You have received your order.' },
  canceled:  { title: 'Canceled',  description: 'Your order has been canceled.', canceled: true },
};

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

/** ISO → "19 Jun 2026" (absolute, locale-stable). Empty string when unusable. */
function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** ISO → "9:18 AM" (time only). Empty string when unusable. */
function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

  // Timeline rows: placement (always, from placed_at) + recorded milestones.
  const timelineRows: { at?: string; title: string; description: string; canceled?: boolean }[] = [
    { at: order.placed_at, title: 'Order Placed', description: 'Your order has been placed successfully.' },
    ...(order.timeline ?? [])
      .filter((t) => STEP_COPY[t.status])
      .map((t) => ({ at: t.at, ...STEP_COPY[t.status] })),
  ];

  return (
    <div className="space-y-6">
      {/* Status timeline */}
      <Card title="Timeline">
        <ol>
          {timelineRows.map((row, i) => {
            const last = i === timelineRows.length - 1;
            const time = formatTime(row.at);
            return (
              <li key={i} className="flex gap-3 sm:gap-4">
                {/* Date / time */}
                <div className="w-20 shrink-0 text-right sm:w-24">
                  <p className="text-xs font-medium text-slate-600">{formatDate(row.at) || '—'}</p>
                  {time && <p className="text-xs text-slate-400">{time}</p>}
                </div>
                {/* Marker + connector */}
                <div className="flex flex-col items-center">
                  <span className={`z-10 flex h-6 w-6 items-center justify-center rounded-full text-white ${row.canceled ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                    {row.canceled ? <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" focusable="false" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" focusable="false" />}
                  </span>
                  {!last && <span className="w-px flex-1 bg-slate-200" />}
                </div>
                {/* Title + description */}
                <div className={`flex-1 ${last ? 'pb-0.5' : 'pb-6'}`}>
                  <p className="font-semibold text-slate-900">{row.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{row.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Order Details + Customer Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Order Details">
          <Row label="Order Number" value={<span className="font-bold text-slate-900">{order.order_number}</span>} />
          <Row label="Status" value={<Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>} />
          <Row label="Payment Method" value={order.payment_method === 'online' ? 'Online Payment' : 'Cash on Delivery'} />
          {zoneLabel && <Row label="Shipping Method" value={zoneLabel} />}
          {placedDate && <Row label="Order Date" value={placedDate} />}
          <Row label="Total" value={<span className="font-bold text-slate-900">{formatBDT(order.total, { currency })}</span>} />
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
