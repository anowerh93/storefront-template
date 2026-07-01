import { useEffect, useState } from 'react';
import { Loader2, LogOut, Package, ShoppingBag, ChevronRight } from 'lucide-react';
import {
  getAccount,
  getMyOrders,
  logoutCustomer,
  getToken,
  UnauthenticatedError,
} from '../lib/api';
import { formatBDT, relativeTime } from '../lib/format';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { customerStatus } from '../lib/order-status';
import { NotFoundPage } from './not-found';
import type { AccountOrderSummary, Customer, StorefrontMeta } from '../lib/types';

/**
 * The customer account page — order history + "track without typing". On mount
 * it redirects to /login when there's no token, otherwise loads the account and
 * order list via the bearer-token endpoints. Each order links to its detail
 * (/order/{number}) which, for a logged-in customer, renders without asking for
 * a phone (the account session is the identity proof).
 */
export function AccountPage({ meta }: { meta: StorefrontMeta | null }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<AccountOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No token → bounce to login before any flash of the page.
    if (!getToken()) {
      window.location.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [acct, list] = await Promise.all([getAccount(), getMyOrders()]);
        if (cancelled) return;
        setCustomer(acct);
        setOrders(list.data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof UnauthenticatedError) {
          window.location.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load your account. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onLogout() {
    await logoutCustomer();
    window.location.href = '/';
  }

  if (!meta) return <NotFoundPage />;

  return (
    <>
      <Header meta={meta} />

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
            <p className="mt-4 text-sm text-slate-500">Loading your account…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            {error}
          </div>
        ) : (
          <>
            {/* Account header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold text-brand-600">My account</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {customer?.name ? `Hi, ${customer.name}` : 'Welcome back'}
                </h1>
                {customer?.phone && <p className="mt-1 text-sm text-slate-500">{customer.phone}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={onLogout}>
                <LogOut className="h-4 w-4" />
                Log out
              </Button>
            </div>

            {/* Orders */}
            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
                <Package className="h-5 w-5 text-slate-500" /> Your orders
              </h2>

              {orders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                  <ShoppingBag className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-600">You haven't placed any orders yet.</p>
                  <a href="/products" className="mt-4 inline-block">
                    <Button variant="brand" size="sm">Start shopping</Button>
                  </a>
                </div>
              ) : (
                <ul className="space-y-3">
                  {orders.map((o) => {
                    const status = customerStatus(o.status);
                    return (
                    <li key={o.order_number}>
                      <a
                        href={`/order/${encodeURIComponent(o.order_number)}`}
                        className="flex items-center gap-4 rounded-2xl bg-white ring-1 ring-slate-200 p-4 transition hover:ring-slate-300"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">#{o.order_number}</span>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {o.placed_at ? relativeTime(o.placed_at) : ''} · {o.item_count} item{o.item_count === 1 ? '' : 's'}
                          </p>
                        </div>
                        <span className="shrink-0 font-bold text-slate-900">{formatBDT(o.total, { currency: o.currency })}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                      </a>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </main>

      <Footer meta={meta} />
    </>
  );
}
