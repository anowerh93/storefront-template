import type { Category, StorefrontMeta } from '../../lib/types';

/**
 * The order page's header and footer on a landing-pages-only build
 * (src/lib/funnels-only.ts). They show the shop's name and nothing else:
 * no navigation, no search, no cart or account, no menus. Those pages do
 * not exist on such a store, and the API refuses their data.
 * Same props as Header / Footer, so a page swaps one for the other.
 */
export function FunnelsOnlyHeader({ meta }: { meta: StorefrontMeta; categories?: Category[] }) {
  return (
    <header className="border-b border-slate-100 bg-white">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6">
        {meta.logo_url ? (
          <img src={meta.logo_url} alt={meta.name} className="h-9 w-auto max-w-[180px] object-contain" />
        ) : (
          <span className="text-lg font-bold text-slate-900">{meta.name}</span>
        )}
      </div>
    </header>
  );
}

export function FunnelsOnlyFooter({ meta }: { meta: StorefrontMeta }) {
  return (
    <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
      <p>© {new Date().getFullYear()} {meta.name}</p>
    </footer>
  );
}
