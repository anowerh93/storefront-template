import { useEffect, useRef, useState } from 'react';
import { Star, Loader2, ImagePlus, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { TurnstileWidget } from '../auth/turnstile';
import { ApiError, submitReview } from '../../lib/api';
import { BD_PHONE_RE } from '../../lib/abandoned';

/**
 * "Write a review" form on the product page (POST …/products/{slug}/reviews).
 *
 * Anyone may write one; it waits for the shop's approval, so a success shows a
 * thank-you and never adds the review to the list. The phone is never shown:
 * the API uses it to give the review a "Verified purchase" badge when that
 * number has a delivered order of this product, and to refuse a second review
 * of the same product from it (409). The only file a shopper may attach is
 * their OWN profile photo.
 *
 * The client checks what the API checks (name ≤ 60, a BD mobile, 1–5 stars,
 * 10–1000 characters, a JPG / PNG / WebP photo ≤ 4 MB) so a refusal is rare;
 * when one comes anyway its field errors land under the fields. Same honeypot
 * + Turnstile discipline as the contact form: the honeypot is read from the
 * live DOM via a ref, and the single-use Turnstile token is reset after every
 * failed submit.
 */

const NAME_MAX = 60;
const BODY_MIN = 10;
const BODY_MAX = 1000;
/** Laravel's `max:4096` (kilobytes). */
const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_EXT = /\.(jpe?g|png|webp)$/i;
const RATING_WORDS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

type Field = 'author_name' | 'customer_phone' | 'rating' | 'body' | 'avatar';
type FieldErrors = Partial<Record<Field, string>>;

/** The element each field's error focuses (the rating focuses its first star). */
const FIELD_IDS: Record<Field, string> = {
  author_name: 'rv-name',
  customer_phone: 'rv-phone',
  rating: 'rv-rating-1',
  body: 'rv-body',
  avatar: 'rv-avatar-btn',
};
const FIELD_ORDER: Field[] = ['author_name', 'customer_phone', 'rating', 'body', 'avatar'];

const MSG = {
  check: 'Please check the highlighted fields.',
  name: 'Please enter your name.',
  nameLong: `Your name can be at most ${NAME_MAX} characters.`,
  phone: 'Please enter your phone number.',
  phoneBad: 'Enter a valid Bangladeshi mobile number',
  rating: 'Please choose a star rating.',
  bodyShort: `Please write at least ${BODY_MIN} characters.`,
  bodyLong: `Your review can be at most ${BODY_MAX} characters.`,
  photoType: 'Please choose a JPG, PNG or WebP photo.',
  photoSize: 'The photo must be 4 MB or smaller.',
  already: 'You have already reviewed this product with this phone number.',
  disabled: 'This shop is not taking reviews right now.',
  gone: 'This product is no longer available, so the review could not be sent.',
  captcha: 'Please complete the security check and try again.',
  captchaDown: 'The security check is not available right now. Please try again in a minute.',
  pendingFull: 'This shop has many reviews waiting to be checked. Please try again later.',
  tooMany: 'Too many attempts. Please wait a few minutes and try again.',
  network: 'Could not connect. Please check your internet connection and try again.',
  generic: 'Sorry, your review could not be sent. Please try again in a minute.',
};

/** Characters as the API counts them (code points, not UTF-16 units). */
function chars(s: string): number {
  return Array.from(s).length;
}

/** Bangla digits → ASCII, spaces / dashes / brackets / dots dropped. */
function normalizePhone(raw: string): string {
  return raw
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[\s\-().]/g, '');
}

function acceptablePhoto(f: File): boolean {
  // Some Android pickers report no type at all: judge those by the name.
  return f.type ? AVATAR_TYPES.includes(f.type) : AVATAR_EXT.test(f.name);
}

/** The API's refusal, in words a shopper can act on. */
function describeFailure(err: unknown): { form: string; fields: FieldErrors } {
  if (!(err instanceof ApiError)) return { form: MSG.network, fields: {} };
  const code = err.code;

  if (code === 'already_reviewed' || err.status === 409) return { form: MSG.already, fields: {} };
  if (code === 'reviews_disabled' || err.status === 403) return { form: MSG.disabled, fields: {} };
  if (code === 'product_not_found' || code === 'storefront_not_found' || err.status === 404) {
    return { form: MSG.gone, fields: {} };
  }
  if (code === 'turnstile_missing' || code === 'turnstile_failed') return { form: MSG.captcha, fields: {} };
  if (code === 'turnstile_unavailable' || err.status === 503) return { form: MSG.captchaDown, fields: {} };
  if (code === 'reviews_pending_full') return { form: MSG.pendingFull, fields: {} };
  if (err.status === 429) return { form: MSG.tooMany, fields: {} };
  // A proxy in front of the API refuses an oversized upload before Laravel sees it.
  if (err.status === 413) return { form: MSG.check, fields: { avatar: MSG.photoSize } };

  if (err.status === 422 && err.fields) {
    const fields: FieldErrors = {};
    let other: string | null = null;
    for (const [key, list] of Object.entries(err.fields)) {
      const first = Array.isArray(list) ? list[0] : undefined;
      if (!first) continue;
      if ((FIELD_ORDER as string[]).includes(key)) fields[key as Field] = String(first);
      else if (key === 'turnstile_token') other = MSG.captcha;
      else other ??= String(first);
    }
    if (Object.keys(fields).length > 0) return { form: MSG.check, fields };
    return { form: other ?? MSG.generic, fields: {} };
  }
  return { form: MSG.generic, fields: {} };
}

export function ReviewForm({
  productSlug,
  siteKey,
  onCancel,
}: {
  productSlug: string;
  siteKey: string | null;
  onCancel?: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const inflight = useRef(false);
  const turnstileToken = useRef<string | null>(null);
  const resetTurnstile = useRef<(() => void) | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // The photo preview is an object URL: revoked when the photo changes or the
  // form goes away.
  useEffect(() => {
    if (!avatar) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatar);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  const bodyCount = chars(body.trim());
  const shownRating = hover || rating;

  function clearError(field: Field) {
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  }

  function focusFirst(found: FieldErrors) {
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first && typeof document !== 'undefined') document.getElementById(FIELD_IDS[first])?.focus();
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    const n = name.trim();
    if (!n) found.author_name = MSG.name;
    else if (chars(n) > NAME_MAX) found.author_name = MSG.nameLong;

    const p = normalizePhone(phone);
    if (!p) found.customer_phone = MSG.phone;
    else if (!BD_PHONE_RE.test(p)) found.customer_phone = MSG.phoneBad;

    if (rating < 1 || rating > 5) found.rating = MSG.rating;

    if (bodyCount < BODY_MIN) found.body = MSG.bodyShort;
    else if (bodyCount > BODY_MAX) found.body = MSG.bodyLong;

    if (avatar && !acceptablePhoto(avatar)) found.avatar = MSG.photoType;
    else if (avatar && avatar.size > AVATAR_MAX_BYTES) found.avatar = MSG.photoSize;
    return found;
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    // Cleared so picking the same file again (after Remove) fires change again.
    e.target.value = '';
    if (!file) return;
    if (!acceptablePhoto(file)) {
      setErrors((x) => ({ ...x, avatar: MSG.photoType }));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setErrors((x) => ({ ...x, avatar: MSG.photoSize }));
      return;
    }
    clearError('avatar');
    setAvatar(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inflight.current) return;

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError(MSG.check);
      focusFirst(found);
      return;
    }

    setFormError(null);
    inflight.current = true;
    setSubmitting(true);

    const fd = new FormData();
    fd.append('author_name', name.trim());
    // 01XXXXXXXXX: the API reads +880 / 880 too, but the bare form is its own.
    fd.append('customer_phone', normalizePhone(phone).replace(/^\+?88(?=01)/, ''));
    fd.append('rating', String(rating));
    fd.append('body', body.trim());
    if (avatar) fd.append('avatar', avatar, avatar.name);
    const trap = honeypot.current?.value;
    if (trap) fd.append('company', trap);
    if (turnstileToken.current) fd.append('turnstile_token', turnstileToken.current);

    try {
      await submitReview(productSlug, fd);
      setDone(true);
    } catch (err) {
      const failure = describeFailure(err);
      setErrors(failure.fields);
      setFormError(failure.form);
      focusFirst(failure.fields);
      resetTurnstile.current?.();
      turnstileToken.current = null;
    } finally {
      inflight.current = false;
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-xl bg-emerald-50 px-5 py-8 text-center ring-1 ring-emerald-100">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-slate-900">Thank you for your review!</p>
        <p className="mt-1 text-sm text-slate-600">The shop will publish it after checking it.</p>
      </div>
    );
  }

  const describedBy = (field: Field, hint?: string) =>
    [errors[field] ? `${FIELD_IDS[field]}-error` : null, hint ?? null].filter(Boolean).join(' ') || undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100 sm:p-5">
      {/* Honeypot — hidden from humans; bots fill it. Read via ref. */}
      <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-bold text-slate-900">Write a review</h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <Label htmlFor="rv-name">Your name <span className="text-rose-500">*</span></Label>
          <Input
            id="rv-name"
            autoComplete="name"
            value={name}
            onChange={(e) => { setName(e.target.value); clearError('author_name'); }}
            maxLength={NAME_MAX}
            aria-invalid={errors.author_name ? true : undefined}
            aria-describedby={describedBy('author_name')}
            className="mt-1.5"
          />
          {errors.author_name && <p id="rv-name-error" className="mt-1 text-xs text-rose-600">{errors.author_name}</p>}
        </div>
        <div className="min-w-0">
          <Label htmlFor="rv-phone">Phone number <span className="text-rose-500">*</span></Label>
          <Input
            id="rv-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); clearError('customer_phone'); }}
            maxLength={32}
            aria-invalid={errors.customer_phone ? true : undefined}
            aria-describedby={describedBy('customer_phone', 'rv-phone-hint')}
            className="mt-1.5"
          />
          {errors.customer_phone && <p id="rv-phone-error" className="mt-1 text-xs text-rose-600">{errors.customer_phone}</p>}
          <p id="rv-phone-hint" className="mt-1 text-xs text-slate-500">
            Not shown on the site. If this number has a delivered order of this product, your review gets a “Verified purchase” badge.
          </p>
        </div>
      </div>

      {/* Star picker: native radios (arrow keys move and choose, Tab enters
          and leaves the group); the stars are their visible labels. */}
      <fieldset aria-describedby={describedBy('rating')}>
        <legend className="text-sm font-medium text-slate-700">Your rating <span className="text-rose-500">*</span></legend>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
                <input
                  id={`rv-rating-${n}`}
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => { setRating(n); clearError('rating'); }}
                  aria-label={`${n} ${n === 1 ? 'star' : 'stars'} — ${RATING_WORDS[n - 1]}`}
                  className="peer sr-only"
                />
                <span className="flex rounded-md p-1 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">
                  <Star
                    aria-hidden="true"
                    className={`h-7 w-7 transition ${n <= shownRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                  />
                </span>
              </label>
            ))}
          </div>
          <span className={`text-sm ${shownRating ? 'font-medium text-slate-700' : 'text-slate-400'}`} aria-hidden="true">
            {shownRating ? RATING_WORDS[shownRating - 1] : 'Tap a star to rate'}
          </span>
        </div>
        {errors.rating && <p id="rv-rating-1-error" className="mt-1 text-xs text-rose-600">{errors.rating}</p>}
      </fieldset>

      <div>
        <Label htmlFor="rv-body">Your review <span className="text-rose-500">*</span></Label>
        <Textarea
          id="rv-body"
          rows={5}
          value={body}
          onChange={(e) => { setBody(e.target.value); clearError('body'); }}
          maxLength={BODY_MAX}
          placeholder="What did you like or dislike about this product?"
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={describedBy('body', 'rv-body-count')}
          className="mt-1.5"
        />
        <div className="mt-1 flex items-start justify-between gap-3 text-xs">
          <span id="rv-body-error" className="min-w-0 text-rose-600">{errors.body ?? ''}</span>
          <span id="rv-body-count" className={`shrink-0 tabular-nums ${bodyCount > 0 && bodyCount < BODY_MIN ? 'text-amber-600' : 'text-slate-400'}`}>
            {bodyCount}/{BODY_MAX}
          </span>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700">
          Your photo <span className="font-normal text-slate-400">(optional)</span>
        </p>
        <p id="rv-avatar-hint" className="mt-1 text-xs text-slate-500">
          Your own profile photo, shown next to your review. JPG, PNG or WebP, up to 4 MB.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-slate-400 ring-1 ring-slate-200">
            {preview ? (
              <img src={preview} alt="Your photo" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-6 w-6" aria-hidden="true" />
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPickPhoto}
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
          />
          <button
            id="rv-avatar-btn"
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-describedby={describedBy('avatar', 'rv-avatar-hint')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {avatar ? 'Change photo' : 'Choose photo'}
          </button>
          {avatar && (
            <button
              type="button"
              onClick={() => { setAvatar(null); clearError('avatar'); }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-rose-600"
            >
              <X className="h-4 w-4" aria-hidden="true" /> Remove
            </button>
          )}
        </div>
        {errors.avatar && <p id="rv-avatar-btn-error" className="mt-1 text-xs text-rose-600">{errors.avatar}</p>}
      </div>

      <TurnstileWidget siteKey={siteKey} onToken={(t) => { turnstileToken.current = t; }} resetRef={resetTurnstile} />

      {formError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{formError}</div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">Your review will appear after the shop checks it.</p>
        <Button type="submit" variant="brand" className="w-full sm:w-auto" disabled={submitting}>
          {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>) : 'Submit review'}
        </Button>
      </div>
    </form>
  );
}
