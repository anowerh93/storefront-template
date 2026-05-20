import { ArrowUpDown } from 'lucide-react';

const OPTIONS: { value: string; label: string }[] = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'price_asc',  label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc',   label: 'Name: A → Z' },
];

/**
 * Sort dropdown. Updates the `sort` query string and resets pagination
 * to page 1. Works on both /products and /categories/[slug] without
 * extra wiring.
 *
 * Astro+CF port: was using next/navigation's useRouter + useSearchParams.
 * Since this component runs as a React island in the browser, we can
 * read URL state straight off window.location and navigate via
 * window.location.href — no router hook needed.
 */
export function SortDropdown({ current, basePath }: { current?: string; basePath: string }) {
  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(
      typeof window === 'undefined' ? '' : window.location.search,
    );
    if (e.target.value && e.target.value !== 'newest') {
      params.set('sort', e.target.value);
    } else {
      params.delete('sort');
    }
    params.delete('page');
    const qs = params.toString();
    window.location.href = basePath + (qs ? `?${qs}` : '');
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300 transition cursor-pointer">
      <ArrowUpDown className="h-4 w-4 text-slate-500" />
      <span className="text-slate-500">Sort:</span>
      <select
        value={current ?? 'newest'}
        onChange={onChange}
        className="bg-transparent border-0 font-medium text-slate-900 focus:outline-none cursor-pointer"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
