import type { APIRoute } from 'astro';
import { getStorefront } from '../lib/api';

/**
 * IndexNow ownership proof — the protocol requires the key to be readable
 * on the site itself. Laravel's SubmitIndexNowJob sends
 * keyLocation: {origin}/indexnow-key.txt with every ping; search engines
 * fetch this file and match it against the submitted key. SSR (like
 * robots.txt) so a freshly minted key works without a redeploy.
 */
export const prerender = false;

export const GET: APIRoute = async () => {
  let key = '';
  try {
    const meta = await getStorefront();
    key = meta?.indexnow_key ?? '';
  } catch {
    // API unreachable — fall through to 404; engines retry the validation.
  }

  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(key, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
