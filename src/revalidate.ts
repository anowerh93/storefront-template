/**
 * ISR webhook receiver — accepts POSTs from the Laravel `RevalidateStorefrontJob`
 * and invalidates Next.js cache tags / paths.
 *
 * Contract (set by app/Services/StorefrontRevalidator.php on the Laravel side):
 *   POST /api/revalidate
 *   Header: X-Revalidate-Secret: <users.revalidate_secret>
 *   Body:   { "event": "product.saved", "paths": ["/", "/products", "/products/foo"] }
 *
 * We accept either `paths` (the canonical Laravel emits) or `tags` (a future
 * extension if/when we move to tag-only invalidation).
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'REVALIDATE_SECRET not configured' }, { status: 500 });
  }

  const got = req.headers.get('x-revalidate-secret');
  if (got !== expected) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 });
  }

  let body: { event?: string; paths?: string[]; tags?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const paths = Array.isArray(body.paths) ? body.paths : [];
  const tags  = Array.isArray(body.tags)  ? body.tags  : [];

  // Path invalidation — what Laravel sends today.
  for (const p of paths) {
    try { revalidatePath(p); } catch {}
    // Also derive tags from common paths for the tag-based fetches in lib/api.ts.
    if (p === '/' || p === '/products') tryTag('storefront');
    if (p === '/products') tryTag('products');
    if (p === '/categories') tryTag('categories');
    if (p.startsWith('/products/')) tryTag(`product:${p.slice('/products/'.length)}`);
    if (p.startsWith('/categories/')) tryTag(`category:${p.slice('/categories/'.length)}`);
  }
  for (const t of tags) tryTag(t);

  return NextResponse.json({ ok: true, paths, tags });
}

// Health check — convenient to hit from a browser when wiring DNS.
export async function GET() {
  return NextResponse.json({ ok: true, info: 'POST signed payloads to revalidate' });
}

function tryTag(tag: string) {
  try { revalidateTag(tag); } catch {}
}
