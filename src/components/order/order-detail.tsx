import { CheckCircle2, Package, Truck } from 'lucide-react';
import { formatBDT, relativeTime } from '../../lib/format';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import type { OrderResponse } from '../../lib/types';

/**
 * The order card UI (status badge + timeline + items + totals), shared by the
 * guest tracking page (order-status.tsx, looked up by phone last-4) and the
 * logged-in account order view (looked up via the bearer-token /customer/orders
 * endpoint). Pure presentational — it receives an already-fetched OrderResponse
 * so the two surfaces can fetch it however they need (guest lookup vs. authed).
 */

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'brand' }> = {
  pending:   { label: 'Order received',        variant: 'brand' },
  on_hold:   { label: 'Awaiting confirmation', variant: 'warning' },
  confirmed: { label: 'Confirmed',             variant: 'brand' },
  shipped:   { label: 'On the way',            variant: 'brand' },
  delivered: { label: 'Delivered',             variant: 'success' },
  cancelled: { label: 'Cancelled',             variant: 'default' },
};

export function OrderDetail({ order }: { order: OrderResponse }) {
  // Prefer the server's status_label when present; fall back to our local map.
  const mapped = STATUS_LABELS[order.status];
  const statusInfo = mapped
    ? { label: order.status_label ?? mapped.label, variant: mapped.variant }
    : { label: order.status_label ?? order.status, variant: 'default' as const };

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-900">Order #{order.order_number}</h1>
        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
      </div>
      <p className="text-xs text-slate-500 mb-5">Placed {order.placed_at ? relativeTime(order.placed_at) : ''}</p>

      {/* Status timeline (simple) */}
      <div className="grid grid-cols-3 gap-2 mb-6 text-xs">
        <TimelineStep icon={CheckCircle2} label="Confirmed" active={['confirmed', 'shipped', 'delivered'].includes(order.status)} />
        <TimelineStep icon={Package} label="Shipped" active={['shipped', 'delivered'].includes(order.status)} />
        <TimelineStep icon={Truck} label="Delivered" active={order.status === 'delivered'} />
      </div>

      <Separator className="my-5" />

      <h3 className="font-semibold text-slate-900 mb-3 text-sm">Items</h3>
      <ul className="space-y-3 mb-5">
        {(order.items ?? []).map((it, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <div className="flex-1">
              <p className="font-medium text-slate-900">{it.product_name}</p>
              {it.variant && <p className="text-xs text-slate-500">{it.variant}</p>}
              <p className="text-xs text-slate-500">Qty: {it.quantity} × {formatBDT(it.unit_price, { currency: order.currency })}</p>
            </div>
            <span className="font-semibold text-slate-900 shrink-0">{formatBDT(it.subtotal, { currency: order.currency })}</span>
          </li>
        ))}
      </ul>

      <Separator />

      <div className="space-y-1.5 text-sm pt-4">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span><span>{formatBDT(order.subtotal, { currency: order.currency })}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Shipping</span><span>{order.shipping_fee === 0 ? 'Free' : formatBDT(order.shipping_fee, { currency: order.currency })}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-slate-900 pt-1">
          <span>Total</span><span>{formatBDT(order.total, { currency: order.currency })}</span>
        </div>
      </div>
    </div>
  );
}

function TimelineStep({ icon: Icon, label, active }: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ${active ? 'bg-brand-50 text-brand-700' : 'bg-slate-50 text-slate-400'}`}>
      <Icon className="h-5 w-5" />
      <span className="font-medium">{label}</span>
    </div>
  );
}
