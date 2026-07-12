import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cdnSrcSet, cdnBlurThumb } from '../../lib/img';

export type CertSlide = { url: string; caption?: string | null };

/**
 * Shared certification / document slider — used on the About page (after the
 * team section) AND in the funnel "Certifications" block, so both look
 * identical. ONE document per view (a scroll-snap strip of full-width slides,
 * card capped to a readable width) that AUTO-ADVANCES every few seconds and
 * wraps back to the first — pausing while the visitor hovers or touches it.
 * Arrows + dots for manual control; swipes natively on touch. Documents show
 * uncropped (object-contain over a blurred self-fill) so any aspect ratio —
 * portrait scan or landscape licence — fits.
 */
export function CertSlider({ items }: { items: CertSlide[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const [idx, setIdx] = useState(0);

  // Track which slide is in view from the real scroll position (covers
  // arrows, autoplay AND native swipes with one source of truth).
  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    setIdx(Math.max(0, Math.min(items.length - 1, Math.round(el.scrollLeft / el.clientWidth))));
  }, [items.length]);

  const goTo = useCallback((i: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el || items.length <= 1) return;

    el.addEventListener('scroll', sync, { passive: true });

    // Pause while the visitor is looking at / touching a document.
    const stop = () => { paused.current = true; };
    const start = () => { paused.current = false; };
    el.addEventListener('mouseenter', stop);
    el.addEventListener('mouseleave', start);
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('touchend', start, { passive: true });

    // Auto-advance; wrap to the first document after the last.
    const timer = setInterval(() => {
      if (paused.current || !scroller.current) return;
      const next = (Math.round(scroller.current.scrollLeft / scroller.current.clientWidth) + 1) % items.length;
      goTo(next);
    }, 3500);

    return () => {
      clearInterval(timer);
      el.removeEventListener('scroll', sync);
      el.removeEventListener('mouseenter', stop);
      el.removeEventListener('mouseleave', start);
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('touchend', start);
    };
  }, [items.length, sync, goTo]);

  if (items.length === 0) return null;

  // One document → a single centred card, no scroll affordances.
  if (items.length === 1) {
    return (
      <div className="mx-auto max-w-lg">
        <CertCard item={items[0]} />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={scroller}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <div key={i} className="min-w-0 shrink-0 grow-0 basis-full snap-center px-1">
            <div className="mx-auto max-w-lg">
              <CertCard item={item} index={i} />
            </div>
          </div>
        ))}
      </div>

      {idx > 0 && (
        <button
          type="button"
          aria-label="Previous certification"
          onClick={() => goTo(idx - 1)}
          className="absolute left-1 top-[42%] z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/95 p-2.5 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {idx < items.length - 1 && (
        <button
          type="button"
          aria-label="Next certification"
          onClick={() => goTo(idx + 1)}
          className="absolute right-1 top-[42%] z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/95 p-2.5 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-white"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div className="mt-3 flex justify-center gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Certification ${i + 1}`}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all ${i === idx ? 'w-5 bg-slate-700' : 'w-2 bg-slate-300 hover:bg-slate-400'}`}
          />
        ))}
      </div>
    </div>
  );
}

function CertCard({ item, index = 0 }: { item: CertSlide; index?: number }) {
  return (
    <figure>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-slate-100 shadow-lg ring-1 ring-slate-200">
        <img
          src={cdnBlurThumb(item.url)}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
        />
        <img
          src={item.url}
          srcSet={cdnSrcSet(item.url)}
          sizes={cdnSrcSet(item.url) ? '(min-width: 640px) 512px, 95vw' : undefined}
          alt={item.caption || `Certification ${index + 1}`}
          loading="lazy"
          className="relative z-[1] h-full w-full object-contain"
        />
      </div>
      {item.caption && (
        <figcaption className="mt-2 text-center text-sm font-medium text-slate-600">{item.caption}</figcaption>
      )}
    </figure>
  );
}
