import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile widget for the customer-auth forms (login / register).
 *
 * The storefront only renders a widget when the tenant has a Turnstile site key
 * configured (`meta.turnstile.site_key`). When there's no key, this component
 * renders nothing and never reports a token — exactly how the order forms
 * already behave (they send no `cf-turnstile-response` header, and the API's
 * VerifyTurnstile middleware no-ops without a configured secret). So auth stays
 * functional in dev / on tenants who haven't enabled Turnstile, and gets bot
 * protection automatically once they have.
 *
 * Loads the Cloudflare script once (idempotent), renders an explicit widget, and
 * pushes the token up via onToken. exposes a `resetRef` so the parent can reset
 * the widget after a failed submit (Turnstile tokens are single-use).
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Turnstile failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Turnstile failed to load'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TurnstileWidget({
  siteKey,
  onToken,
  resetRef,
}: {
  siteKey: string | null | undefined;
  onToken: (token: string | null) => void;
  /** Parent fills this with a reset() fn it can call after a failed submit. */
  resetRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
        if (resetRef) {
          resetRef.current = () => {
            if (window.turnstile && widgetId.current) {
              window.turnstile.reset(widgetId.current);
              onToken(null);
            }
          };
        }
      })
      .catch(() => {
        // Script blocked / offline — leave the token null. The submit handlers
        // proceed without a token (the API tolerates a missing one when no
        // secret is configured); a tenant that REQUIRES Turnstile would get a
        // server-side rejection surfaced as the form error.
      });

    return () => {
      cancelled = true;
      if (window.turnstile && widgetId.current) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // ignore
        }
      }
      if (resetRef) resetRef.current = null;
    };
    // siteKey is stable per page; onToken/resetRef are stable refs from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="mt-1" />;
}
