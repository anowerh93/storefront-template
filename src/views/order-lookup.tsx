import { MessageCircle, ShieldCheck, Truck, HelpCircle } from 'lucide-react';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { Button } from '../components/ui/button';
import { OrderLookupForm } from '../components/order/order-lookup-form';
import { NotFoundPage } from './not-found';
import type { StorefrontMeta } from '../lib/types';

/**
 * Astro+CF port: previously async-fetched its own storefront meta.
 * Now receives `meta` as a prop from the Astro page wrapper so the
 * component itself can hydrate as a sync client island.
 */
export function OrderLookupPage({ meta }: { meta: StorefrontMeta | null }) {
  if (!meta) return <NotFoundPage />;

  return (
    <>
      <Header meta={meta} />

      <main className="mx-auto max-w-md px-4 sm:px-6 py-10 sm:py-14">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mb-5">
          <Truck className="h-7 w-7" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 text-center">Track your order</h1>
        <p className="text-sm text-slate-500 mb-6 text-center">
          Enter your order number and the last 4 digits of the phone number you used to place the order.
        </p>

        <OrderLookupForm />

        {/* Helpful tip */}
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <HelpCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-700">Where can I find my order number?</strong>
            <br />
            Check the SMS or Messenger reply you received when you placed the order. It usually starts with letters and looks like <code className="font-mono text-slate-900">ABC123</code>.
          </p>
        </div>

        {/* Trust strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 text-center">
          <Trust icon={ShieldCheck} title="Secure" subtitle="Phone-verified lookup" />
          <Trust icon={Truck} title="Cash on Delivery" subtitle="Pay when it arrives" />
        </div>

        {/* Need more help? */}
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-5 text-center">
          <h3 className="font-semibold text-slate-900 text-sm">Can&rsquo;t find your order?</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            We&rsquo;re here to help. Reach out and we&rsquo;ll track it down for you.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {meta.messenger?.url && (
              <a href={meta.messenger.url} target="_blank" rel="noopener">
                <Button variant="brand" size="sm">
                  <MessageCircle className="h-4 w-4" />
                  Message us
                </Button>
              </a>
            )}
            <a href="/products">
              <Button variant="outline" size="sm">Continue shopping</Button>
            </a>
          </div>
        </div>
      </main>

      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} />
    </>
  );
}

function Trust({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-3 flex flex-col items-center gap-1">
      <Icon className="h-5 w-5 text-brand-600" />
      <p className="text-xs font-semibold text-slate-900">{title}</p>
      <p className="text-[10px] text-slate-500">{subtitle}</p>
    </div>
  );
}
