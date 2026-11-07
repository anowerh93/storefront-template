import { useState } from 'react';
import { Star, BadgeCheck, PenLine } from 'lucide-react';
import { cdnImage } from '../../lib/img';
import { ReviewForm } from './review-form';
import type { ProductDetail, ProductReview } from '../../lib/types';

/**
 * The PDP's Reviews tab: the approved-review summary (true aggregates from the
 * API, not the length of the list it sent), the reviews themselves, and — when
 * the shop takes reviews (`reviews.write_enabled`) — a "Write a review" button
 * that opens the form above the list. A submitted review waits for the shop's
 * approval, so it is never added to this list.
 */

/** Reviews shown at first, and added per "Show more". */
const PAGE = 10;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Jun 16, 2026" without locale-data surprises on Workers (as the blog dates). */
function reviewDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * The avatar's letter: the name's first LETTER (or digit) as one code point —
 * never a byte, and never a vowel sign or hasanta on its own, so "রহিম" → "র",
 * "শ্রী" → "শ". Deliberately not Intl.Segmenter: its Bengali conjunct rules
 * differ between ICU versions, and this text is rendered on the edge and again
 * in the browser (a mismatch would break hydration).
 */
function initialOf(name: string): string {
  const m = name.normalize('NFC').match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : '?';
}

function Stars({ value, className, label }: { value: number; className: string; label: string }) {
  const filled = Math.round(value);
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={`${className} ${n <= filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
        />
      ))}
    </span>
  );
}

function ReviewAvatar({ name, url }: { name: string; url: string | null }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <img
        src={cdnImage(url, 192)}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-10 w-10 shrink-0 rounded-full bg-slate-100 object-cover ring-1 ring-slate-200"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700"
    >
      {initialOf(name)}
    </span>
  );
}

function ReviewItem({ review }: { review: ProductReview }) {
  const name = review.author_name?.trim() || 'Customer';
  const rating = Number(review.rating) || 0;
  const date = reviewDate(review.created_at);
  const images = (review.images ?? []).filter(Boolean);

  return (
    <article className="flex gap-3 border-b border-slate-100 pb-5 last:border-0 last:pb-0">
      <ReviewAvatar name={name} url={review.avatar_url} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 text-sm font-semibold text-slate-900 wrap-anywhere">{name}</span>
          {review.verified_purchase === true && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified purchase
            </span>
          )}
        </div>
        {(review.location || date) && (
          <p className="mt-0.5 text-xs text-slate-500 wrap-anywhere">
            {review.location}
            {review.location && date ? ' · ' : ''}
            {date && <time dateTime={review.created_at}>{date}</time>}
          </p>
        )}
        <div className="mt-1.5">
          <Stars value={rating} className="h-3.5 w-3.5" label={`Rated ${rating} out of 5`} />
        </div>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600 wrap-anywhere">{review.body}</p>
        {images.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {images.map((src, i) => (
              <a
                key={i}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 transition hover:ring-slate-300"
              >
                <img
                  src={cdnImage(src, 192)}
                  alt={`Photo ${i + 1} with ${name}'s review`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function ProductReviews({ product, siteKey }: { product: ProductDetail; siteKey: string | null }) {
  const items = product.reviews?.items ?? [];
  const count = Number(product.reviews?.count) || 0;
  const rawAverage = product.reviews?.average;
  const average = rawAverage == null ? null : Number(rawAverage);
  const hasSummary = count > 0 && average != null && Number.isFinite(average);
  const canWrite = product.reviews?.write_enabled === true;

  const [shown, setShown] = useState(PAGE);
  const [writing, setWriting] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {hasSummary ? (
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-3xl font-bold tabular-nums text-slate-900">{average!.toFixed(1)}</span>
            <div className="min-w-0">
              <Stars value={average!} className="h-4 w-4" label={`${average!.toFixed(1)} out of 5 stars`} />
              <p className="mt-0.5 text-xs text-slate-500">
                Based on {count} {count === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <p className="min-w-0 text-sm text-slate-500">No reviews yet. Be the first to review this product.</p>
        ) : (
          <span />
        )}
        {canWrite && !writing && (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <PenLine className="h-4 w-4" aria-hidden="true" /> Write a review
          </button>
        )}
      </div>

      {canWrite && writing && (
        <ReviewForm productSlug={product.slug} siteKey={siteKey} onCancel={() => setWriting(false)} />
      )}

      {items.length > 0 && (
        <div className="space-y-5">
          {items.slice(0, shown).map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </div>
      )}

      {items.length > shown && (
        <button
          type="button"
          onClick={() => setShown((s) => s + PAGE)}
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Show more reviews ({items.length - shown} more)
        </button>
      )}
    </div>
  );
}
