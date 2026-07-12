import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cdnSrcSet, cdnBlurThumb } from '../../lib/img';

export type CertSlide = { url: string; caption?: string | null };

/**
 * Shared certification / document slider — used on the About page (after the
 * team section) AND in the funnel "Certifications" block, so both look
 * identical. A horizontal scroll-snap strip (pure CSS, no carousel lib): each
 * document shows uncropped (object-contain over a blurred self-fill) so any
 * aspect ratio — portrait scan or landscape licence — fits. Swipes on touch,
 * arrow buttons on desktop.
 */
export function CertSlider({ items }: { items: CertSlide[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  const nudge = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  // One document → a single centred card, no scroll affordances.
  if (items.length === 1) {
    return (
      <div className="mx-auto max-w-xs">
        <CertCard item={items[0]} />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={scroller}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <div key={i} className="min-w-0 shrink-0 grow-0 basis-[78%] snap-center sm:basis-[46%] lg:basis-[31%]">
            <CertCard item={item} index={i} />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous certification"
        onClick={() => nudge(-1)}
        className="absolute left-1 top-[38%] z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/95 p-2.5 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-white sm:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Next certification"
        onClick={() => nudge(1)}
        className="absolute right-1 top-[38%] z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/95 p-2.5 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-white sm:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
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
          sizes={cdnSrcSet(item.url) ? '(min-width: 1024px) 320px, 78vw' : undefined}
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
