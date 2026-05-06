'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpDown } from 'lucide-react';

const OPTIONS: { value: string; label: string }[] = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'price_asc',  label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc',   label: 'Name: A → Z' },
];

/**
 * Server-friendly sort dropdown. Updates the `sort` query string and
 * resets pagination back to page 1. Works on both /products and
 * /categories/[slug] without any extra wiring.
 */
export function SortDropdown({ current, basePath }: { current?: string; basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams?.toString());
    if (e.target.value && e.target.value !== 'newest') {
      params.set('sort', e.target.value);
    } else {
      params.delete('sort');
    }
    params.delete('page');
    const qs = params.toString();
    router.push(basePath + (qs ? `?${qs}` : ''));
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
