import { useRef, useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { registerCustomer, setToken, getToken, ApiError } from '../lib/api';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { TurnstileWidget } from '../components/auth/turnstile';
import { NotFoundPage } from './not-found';
import type { StorefrontMeta } from '../lib/types';

/**
 * Customer registration. name + phone + optional email + password (min 6). On
 * success the bearer token is stored and we redirect to /account; any orders
 * that already match this phone get auto-claimed server-side (claimed_orders).
 * A 409 account_exists means the phone/email is already registered → we point
 * them at /login instead of showing a dead-end error.
 */
export function RegisterPage({ meta }: { meta: StorefrontMeta | null }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const turnstileToken = useRef<string | null>(null);
  const resetTurnstile = useRef<(() => void) | null>(null);

  if (!meta) return <NotFoundPage />;

  if (typeof window !== 'undefined' && getToken()) {
    window.location.replace('/account');
    return null;
  }

  const siteKey = meta.turnstile?.site_key ?? null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setExists(false);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerCustomer({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        password,
        cf_turnstile_response: turnstileToken.current ?? undefined,
      });
      setToken(res.token);
      window.location.href = '/account';
    } catch (err) {
      if (err instanceof ApiError && err.code === 'account_exists') {
        setExists(true);
      } else {
        setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.');
      }
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
          <UserPlus className="h-7 w-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 text-center">Create an account</h1>
        <p className="text-sm text-slate-500 mb-6 text-center">
          Save your details and track all your orders in one place.
        </p>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
          {exists && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              An account with this phone or email already exists.{' '}
              <a href="/login" className="font-semibold underline">Log in instead</a>.
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
          )}

          <div>
            <Label htmlFor="reg-name">Full name</Label>
            <Input
              id="reg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <Label htmlFor="reg-phone">Phone</Label>
            <Input
              id="reg-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              inputMode="tel"
              autoComplete="tel"
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <Label htmlFor="reg-email">Email <span className="font-normal text-slate-400">(optional)</span></Label>
            <Input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="reg-pw">Password</Label>
            <Input
              id="reg-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
              className="mt-1.5"
              minLength={6}
              required
            />
          </div>

          <TurnstileWidget
            siteKey={siteKey}
            onToken={(t) => { turnstileToken.current = t; }}
            resetRef={resetTurnstile}
          />

          <Button type="submit" variant="brand" className="w-full" disabled={submitting}>
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>) : 'Create account'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <a href="/login" className="font-semibold text-brand-600 hover:underline">Log in</a>
        </p>
      </main>

      <Footer meta={meta} />
    </>
  );
}
