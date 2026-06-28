import { useRef, useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { loginCustomer, setToken, getToken } from '../lib/api';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { TurnstileWidget } from '../components/auth/turnstile';
import { NotFoundPage } from './not-found';
import type { StorefrontMeta } from '../lib/types';

/**
 * Customer login. Phone OR email + password. On success the bearer token is
 * stored (slug-scoped localStorage) and we redirect to /account. Accounts are
 * OPT-IN — guest checkout + guest order lookup stay fully usable without one.
 */
export function LoginPage({ meta }: { meta: StorefrontMeta | null }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileToken = useRef<string | null>(null);
  const resetTurnstile = useRef<(() => void) | null>(null);

  if (!meta) return <NotFoundPage />;

  // Already logged in → straight to the account page (no flash of the form).
  if (typeof window !== 'undefined' && getToken()) {
    window.location.replace('/account');
    return null;
  }

  const siteKey = meta.turnstile?.site_key ?? null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await loginCustomer({
        identifier: identifier.trim(),
        password,
        cf_turnstile_response: turnstileToken.current ?? undefined,
      });
      setToken(res.token);
      window.location.href = '/account';
    } catch (err) {
      // 422 invalid_credentials (and everything else) → a single generic line.
      setError(err instanceof Error ? err.message : 'Could not log you in. Please try again.');
      resetTurnstile.current?.();
      turnstileToken.current = null;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header meta={meta} />

      <main className="mx-auto max-w-md px-4 sm:px-6 py-10 sm:py-14">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mb-5">
          <LogIn className="h-7 w-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 text-center">Log in</h1>
        <p className="text-sm text-slate-500 mb-6 text-center">
          Access your order history and track orders without typing anything.
        </p>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
          )}

          <div>
            <Label htmlFor="login-id">Phone or email</Label>
            <Input
              id="login-id"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="01XXXXXXXXX or you@email.com"
              autoComplete="username"
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <Label htmlFor="login-pw">Password</Label>
            <Input
              id="login-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              className="mt-1.5"
              required
            />
          </div>

          <TurnstileWidget
            siteKey={siteKey}
            onToken={(t) => { turnstileToken.current = t; }}
            resetRef={resetTurnstile}
          />

          <Button type="submit" variant="brand" className="w-full" disabled={submitting}>
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Logging in…</>) : 'Log in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          New here?{' '}
          <a href="/register" className="font-semibold text-brand-600 hover:underline">Create an account</a>
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          Or{' '}
          <a href="/order/lookup" className="font-medium text-slate-700 hover:underline">track an order as a guest</a>.
        </p>
      </main>

      <Footer meta={meta} />
    </>
  );
}
