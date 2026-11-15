/**
 * A landing page's old link forwards to its new one (src/pages/[slug].astro).
 *
 * Kept out of the .astro frontmatter on purpose: the live builder's Astro
 * compiler (2.13.x) ends a regex literal at a "/" inside a character class
 * (`/^\/(?![/\\])/`), then pairs the next template literal's backticks wrong
 * and swallows the frontmatter fence — "Expected '>' but found 'title'" on
 * every build. A .ts file is compiled by esbuild, which reads JS correctly.
 */

/**
 * Only a local path is followed, never "//host" or "/\host" (a poisoned
 * to_path must not become an open redirect), and never the page itself.
 */
export function isLocalForward(to: string | undefined, slug: string): to is string {
  if (!to || !to.startsWith('/')) return false;
  const second = to.charAt(1);
  if (second === '/' || second === '\\') return false;
  return to !== '/' + slug;
}

/**
 * The ad's query string (utm_*, fbclid: the pixel and attribution need them)
 * goes along; a stored path that already has a query gets "&", never a second
 * "?".
 */
export function withQuery(to: string, query: string): string {
  if (!query) return to;
  return to + (to.includes('?') ? '&' : '?') + query;
}
