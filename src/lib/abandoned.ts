/**
 * Abandoned Cart Recovery — the storefront half.
 *
 * Once the shopper has typed a VALID phone on the checkout / funnel form, we
 * beacon the partial form + cart to the API (debounced on every change, and
 * flushed with `keepalive` when the page is hidden/unloaded) so the shop's
 * Orders → "Abandoned" tab can list them for a call-back. The row is keyed by
 * an anonymous per-browser cart key, so repeat beacons UPSERT one row.
 *
 * Rules that keep this honest:
 *  - Nothing is sent until the phone passes the BD-mobile regex — a row you
 *    can't call is useless, and a half-typed number is not consent to store.
 *  - After the order succeeds, markOrdered() stops every further beacon (the
 *    page-leave flush racing the success redirect would otherwise resurrect a
 *    just-recovered cart) and rotates the cart key so the NEXT checkout on
 *    this browser is a fresh row.
 *  - Fire-and-forget: a failed beacon never surfaces to the shopper.
 */
import { useCallback, useEffect, useRef } from 'react';
import { captureAbandonedCart, STOREFRONT_SLUG } from './api';
import type { AbandonedCartInput } from './types';

const KEY = `sf_ck_${STOREFRONT_SLUG}`;
const DEBOUNCE_MS = 1500;

/** Same BD-mobile rule as the zod schemas in checkout.tsx / funnel.tsx. */
export const BD_PHONE_RE = /^(\+?88)?01[3-9]\d{8}$/;

function mintKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '');
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Private-mode fallback when localStorage throws: per-page-load identity. */
let memoryKey: string | null = null;

/** The browser's anonymous cart key — minted on first use, stable until rotated. */
export function getCartKey(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const fresh = mintKey();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    if (!memoryKey) memoryKey = mintKey();
    return memoryKey;
  }
}

/** After a successful order: the next checkout on this browser is a new cart. */
export function rotateCartKey(): void {
  memoryKey = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Wire the beacon into a form. `build()` returns the payload for the CURRENT
 * form + cart state, or null when there's nothing worth capturing yet (no
 * valid phone / empty cart). Call `touch()` on every change; call
 * `markOrdered()` the moment the order API succeeds.
 */
export function useAbandonedCapture(build: () => AbandonedCartInput | null) {
  const buildRef = useRef(build);
  buildRef.current = build;
  const timer = useRef<number | null>(null);
  /** JSON of the last payload handed to fetch — dedupes unchanged state. */
  const lastSent = useRef('');
  /** JSON of a PLAIN (non-keepalive) request still in flight — page-leave
   *  would cancel it, so the flush re-sends that exact payload with keepalive. */
  const inflight = useRef<string | null>(null);
  const ordered = useRef(false);

  const send = useCallback((keepalive: boolean) => {
    if (ordered.current) return;
    let payload: AbandonedCartInput | null = null;
    try {
      payload = buildRef.current();
    } catch {
      return;
    }
    if (!payload) return;
    const json = JSON.stringify(payload);
    if (json === lastSent.current && !(keepalive && inflight.current === json)) return;
    lastSent.current = json;
    if (!keepalive) inflight.current = json;
    captureAbandonedCart(payload, keepalive)
      .then(() => {
        if (inflight.current === json) inflight.current = null;
      })
      .catch(() => {
        // Cancelled by navigation / offline / throttled — let the next touch
        // or flush try again with whatever the form holds then.
        if (inflight.current === json) inflight.current = null;
        if (lastSent.current === json) lastSent.current = '';
      });
  }, []);

  const touch = useCallback(() => {
    if (ordered.current || typeof window === 'undefined') return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      send(false);
    }, DEBOUNCE_MS);
  }, [send]);

  // Page-leave flush: whatever is pending goes out NOW, with keepalive.
  useEffect(() => {
    const flush = () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      send(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [send]);

  const markOrdered = useCallback(() => {
    ordered.current = true;
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    rotateCartKey();
  }, []);

  return { touch, markOrdered };
}
