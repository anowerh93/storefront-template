import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Package, Truck, MessageCircle } from 'lucide-react';
import { lookupOrder, getStorefront } from '../lib/api';
import { formatBDT, relativeTime } from '../lib/format';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { OrderLookupForm } from '../components/order/order-lookup-form';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'brand' }> = {
  pending:   { label: 'Order received',  variant: 'brand' },
  on_hold:   { label: 'Awaiting confirmation', variant: 'warning' },
  confirmed: { label: 'Confirmed',       variant: 'brand' },
  shipped:   { label: 'On the way',      variant: 'brand' },
  delivered: { label: 'Delivered',       variant: 'success' },
  cancelled: { label: 'Cancelled',       variant: 'default' },
};

export async function OrderStatusPage({
  orderNumber,
  searchParams,
}: {
  orderNumber: string;
  searchParams?: { phone?: string; placed?: string };
}) {
  const meta = await getStorefront();

  // No phone → render the lookup form (the customer needs to verify identity).
  if (!searchParams?.phone) {
    return (
      <>
        <Header meta={meta} />
        <main className="mx-auto max-w-md px-4 sm:px-6 py-10">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Track order #{orderNumber}</h1>
          <p className="text-sm text-slate-500 mb-6">Enter the last 4 digits of the phone number you used to place the order.</p>
          <OrderLookupForm orderNumber={orderNumber} />
        </main>
        <Footer meta={meta} />
      </>
    );
  }

  let order;
  try {
    order = await lookupOrder(orderNumber, searchParams.phone);
  } catch {
    notFound();
  }

  const justPlaced = searchParams.placed === '1';
  const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, variant: 'default' as const };

  return (
    <>
      <Header meta={meta} />

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10">
        {justPlaced && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 mb-6 flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <h2 className="font-semibold text-emerald-900">Order placed!</h2>
              <p className="text-sm text-emerald-700 mt-0.5">
                We've received your order and will contact you shortly to confirm the details.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Order #{order.order_number}</h1>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <p className="text-xs text-slate-500 mb-5">Placed {order.placed_at ? relativeTime(order.placed_at) : ''}</p>

          {/* Status timeline (simple) */}
          <div className="grid grid-cols-3 gap-2 mb-6 text-xs">
            <TimelineStep icon={CheckCircle2} label="Confirmed" active={['confirmed','shipped','delivered'].includes(order.status)} />
            <TimelineStep icon={Package} label="Shipped" active={['shipped','delivered'].includes(order.status)} />
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
                  <p className="text-xs text-slate-500">Qty: {it.quantity} × {formatBDT(it.unit_price)}</p>
                </div>
                <span className="font-semibold text-slate-900 shrink-0">{formatBDT(it.subtotal)}</span>
              </li>
            ))}
          </ul>

          <Separator />

          <div className="space-y-1.5 text-sm pt-4">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span><span>{formatBDT(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Shipping</span><span>{order.shipping_fee === 0 ? 'Free' : formatBDT(order.shipping_fee)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 pt-1">
              <span>Total</span><span>{formatBDT(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          {meta.messenger?.url && (
            <a href={meta.messenger.url} target="_blank" rel="noopener">
              <Button variant="outline">
                <MessageCircle className="h-4 w-4" />
                Need help? Message us
              </Button>
            </a>
          )}
          <Link href="/products">
            <Button variant="brand">Continue shopping</Button>
          </Link>
        </div>
      </main>

      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} />
    </>
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
