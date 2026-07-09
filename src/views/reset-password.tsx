import { useRef, useState } from 'react';
import { KeyRound, Loader2, Mail, MessageSquare, ArrowLeft } from 'lucide-react';
import { forgotPassword, resetPassword, setToken, getToken } from '../lib/api';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { TurnstileWidget } from '../components/auth/turnstile';
import { NotFoundPage } from './not-found';
import type { StorefrontMeta } from '../lib/types';

type Channel = 'sms' | 'email';
type Step = 'request' | 'verify';

/**
 * Customer password reset — a single-page, two-step wizard.
 *
 *   Step 1 (request): pick a channel (SMS or email) + enter phone/email → the
 *                     API mails/texts a 6-digit code.
 *   Step 2 (verify):  enter the code + a new password → verified server-side,
 *                     the shopper is logged straight in (fresh token) → /account.
 *
 * Anti-enumeration: step 1 always "succeeds" (the API never reveals whether an
 * account exists), so we advance to step 2 on any resolved request. A shopper
 * who already has a code (e.g. came back later) can jump straight to step 2.
 */
export function ResetPasswordPage({ meta }: { meta: StorefrontMeta | null }) {
  const [step, setStep] = useState<Step>('request');
  const [channel, setChannel] = useState<Channel>('sms');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileToken = useRef<string | null>(null);
  const resetTurnstile = useRef<(() => void) | null>(null);

  if (!meta) return <NotFoundPage />;

  // Already logged in → nothing to reset; go to the account page.
  if (typeof window !== 'undefined' && getToken()) {
    window.location.replace('/account');
    return null;
  }

  const siteKey = meta.turnstile?.site_key ?? null;

  function clearTurnstile() {
    resetTurnstile.current?.();
    turnstileToken.current = null;
  }

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword({
        channel,
        identifier: identifier.trim(),
        cf_turnstile_response: turnstileToken.current ?? undefined,
      });
      // Always advance — the API is deliberately generic about existence.
      clearTurnstile();
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a code. Please try again.');
      clearTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await resetPassword({
        identifier: identifier.trim(),
        code: code.trim(),
        password,
        cf_turnstile_response: turnstileToken.current ?? undefined,
      });
      setToken(res.token);
      window.location.href = '/account';
    } catch (err) {
      // reset_failed (bad/expired code) + everything else → one generic line.
      setError(err instanceof Error ? err.message : 'The code is invalid or has expired. Please request a new one.');
      clearTurnstile();
      setSubmitting(false);
    }
  }

  const channelBtn = (value: Channel, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setChannel(value)}
      className={
        'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ' +
        (channel === value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')
      }
      aria-pressed={channel === value}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <Header meta={meta} />

      <main className="mx-auto max-w-md px-4 sm:px-6 py-10 sm:py-14">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mb-5">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 text-center">Reset your password</h1>

        {step === 'request' ? (
          <>
            <p className="text-sm text-slate-500 mb-6 text-center">
              Choose where to send your 6-digit reset code.
            </p>

            <form onSubmit={onRequest} className="space-y-4 rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                {channelBtn('sms', <MessageSquare className="h-4 w-4" />, 'SMS')}
                {channelBtn('email', <Mail className="h-4 w-4" />, 'Email')}
              </div>

              <div>
                <Label htmlFor="rp-id">{channel === 'sms' ? 'Phone number' : 'Email address'}</Label>
                <Input
                  id="rp-id"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={channel === 'sms' ? '01XXXXXXXXX' : 'you@email.com'}
                  inputMode={channel === 'sms' ? 'tel' : 'email'}
                  autoComplete={channel === 'sms' ? 'tel' : 'email'}
                  className="mt-1.5"
                  required
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  {channel === 'sms'
                    ? 'We’ll text the code to the number on your account.'
                    : 'We’ll email the code to the address on your account.'}
                </p>
              </div>

              <TurnstileWidget
                siteKey={siteKey}
                onToken={(t) => { turnstileToken.current = t; }}
                resetRef={resetTurnstile}
              />

              <Button type="submit" variant="brand" className="w-full" disabled={submitting}>
                {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending code…</>) : 'Send code'}
              </Button>

              <button
                type="button"
                onClick={() => { setError(null); setStep('verify'); }}
                className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                I already have a code
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-6 text-center">
              If an account matches, we’ve sent a code. Enter it below with your new password.
            </p>

            <form onSubmit={onReset} className="space-y-4 rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
              )}

              <div>
                <Label htmlFor="rp-id2">Phone or email</Label>
                <Input
                  id="rp-id2"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="01XXXXXXXXX or you@email.com"
                  autoComplete="username"
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="rp-code">Reset code</Label>
                <Input
                  id="rp-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="mt-1.5 tracking-[0.4em] text-center text-lg"
                  required
                />
              </div>
              <div>
                <Label htmlFor="rp-pw">New password</Label>
                <Input
                  id="rp-pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  minLength={6}
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="rp-confirm">Confirm new password</Label>
                <Input
                  id="rp-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  minLength={6}
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
                {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Resetting…</>) : 'Reset password'}
              </Button>

              <button
                type="button"
                onClick={() => { setError(null); clearTurnstile(); setStep('request'); }}
                className="flex w-full items-center justify-center gap-1.5 text-center text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Start over / resend code
              </button>
            </form>
          </>
        )}

        <p className="mt-5 text-center text-sm text-slate-600">
          Remembered it?{' '}
          <a href="/login" className="font-semibold text-brand-600 hover:underline">Log in</a>
        </p>
      </main>

      <Footer meta={meta} />
    </>
  );
}
