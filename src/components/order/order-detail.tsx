import { CheckCircle2, Package, Truck, XCircle } from 'lucide-react';
import { formatBDT } from '../../lib/format';
import { Badge } from '../ui/badge';
import type { OrderResponse, StorefrontMeta } from '../../lib/types';

/**
 * The order summary UI, shared by the guest tracking page (order-status.tsx,
 * looked up by phone last-4) and the logged-in account order view (looked up
 * via the bearer-token /customer/orders endpoint). Pure presentational — it
 * receives an already-fetched OrderResponse so the two surfaces can fetch it
 * however they need (guest lookup vs. authed).
 *
 * Layout mirrors a classic order-confirmation receipt: an "Order Details" +
 * "Customer Details" pair, then an "Ordered Products" table with a totals
 * footer. An optional status timeline shows on the tracking surface (not on
 * the fresh success screen, which is already topped by a success banner).
 */

// Keys MUST match the backend status strings exactly (App\Models\Order::STATUS_*);
// note 'canceled' is spelled with one L. status_label from the server wins for
// the text — these labels are fallbacks; the variant is what each key drives.
const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'brand' }> = {
  awaiting_verification: { label: 'Awaiting verification', variant: 'warning' },
  pending:   { label: 'Order received',        variant: 'brand' },
  on_hold:   { label: 'Awaiting confirmation', variant: 'warning' },
  confirmed: { label: 'Confirmed',             variant: 'brand' },
  shipped:   { label: 'On the way',            variant: 'brand' },
  delivered: { label: 'Delivered',             variant: 'success' },
  canceled:  { label: 'Canceled',              variant: 'default' },
};

/** ISO → "29 Jun 2026" (absolute, locale-stable). Empty string when unusable. */
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
  showTimeline = false,
}: {
  order: OrderResponse;
  /** Storefront meta — used to resolve the shipping-zone code to its label. */
  meta?: StorefrontMeta | null;
  /** Last 4 digits of the phone (from the success/lookup URL) → masked display. */
  phoneLast4?: string;
  /** Show the Confirmed → Shipped → Delivered strip (tracking surface only). */
  showTimeline?: boolean;
}) {
  // Prefer the server's status_label when present; fall back to our local map.
  const mapped = STATUS_LABELS[order.status];
  const statusInfo = mapped
    ? { label: order.status_label ?? mapped.label, variant: mapped.variant }
    : { label: order.status_label ?? order.status, variant: 'default' as const };
  const isCanceled = order.status === 'canceled';

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

  return (
    <div className="space-y-6">
      {/* Optional status timeline (tracking surface). */}
      {showTimeline && (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Order status</h2>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          {/* The Confirmed → Shipped → Delivered strip only makes sense on the
              fulfillment path; a canceled order shows an explicit notice instead
              of three greyed steps that read as a stalled progress bar. */}
          {isCanceled ? (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              <XCircle className="h-5 w-5 shrink-0" />
              This order has been canceled.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <TimelineStep icon={CheckCircle2} label="Confirmed" active={['confirmed', 'shipped', 'delivered'].includes(order.status)} />
              <TimelineStep icon={Package} label="Shipped" active={['shipped', 'delivered'].includes(order.status)} />
              <TimelineStep icon={Truck} label="Delivered" active={order.status === 'delivered'} />
            </div>
          )}
        </div>
      )}

      {/* Order Details + Customer Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Order Details">
          <Row label="Order Number" value={<span className="font-bold text-slate-900">{order.order_number}</span>} />
          <Row label="Status" value={<Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>} />
          <Row label="Payment Method" value="Cash on Delivery" />
          {zoneLabel && <Row label="Shipping Method" value={zoneLabel} />}
          {placedDate && <Row label="Order Date" value={placedDate} />}
          <Row label="Total" value={<span className="font-bold text-slate-900">{formatBDT(order.total, { currency })}</span>} />
        </Card>

        <Card title="Customer Details">
          {order.customer_name && <Row label="Name" value={order.customer_name} multiline />}
          {maskedPhone && <Row label="Phone" value={<span className="tabular-nums">{maskedPhone}</span>} />}
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
                        {it.variant && <p className="text-xs text-slate-500">{it.variant}</p>}
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
                  {it.variant && <p className="text-xs text-slate-500">{it.variant}</p>}
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

function TimelineStep({ icon: Icon, label, active }: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 rounded-xl p-3 ${active ? 'bg-brand-50 text-brand-700' : 'bg-slate-50 text-slate-400'}`}>
      <Icon className="h-5 w-5" />
      <span className="font-medium">{label}</span>
    </div>
  );
}
