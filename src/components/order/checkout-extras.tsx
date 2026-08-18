import type { UseFormRegisterReturn } from 'react-hook-form';
import { Wallet } from 'lucide-react';
import type { StorefrontMeta } from '../../lib/types';
import { BD_DISTRICTS } from '../../lib/districts';
import { formatBDT } from '../../lib/format';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/**
 * Shared checkout extras used by BOTH the storefront checkout and the funnel
 * order form:
 *
 *  - জেলা (district, native <datalist> type-ahead — free text allowed) +
 *    থানা fields, rendered only when the tenant opted in
 *    (meta.checkout.district_enabled);
 *  - the advance-payment box: amount to send now, the tenant's wallet
 *    numbers VERBATIM from the API (never reformatted), and the optional
 *    "sender last-4" field. COD only — the caller hides it for online
 *    payment, which collects the full total at the gateway.
 *
 * The displayed amount mirrors the server rule (delivery charge + extra at/
 * over the threshold, on the SUBTOTAL) for display only — the authoritative
 * advance is stamped server-side at order creation.
 */

export function advanceAmountFor(
  advance: NonNullable<StorefrontMeta['advance_payment']>,
  subtotal: number,
): number {
  const extra =
    advance.threshold !== null && advance.extra_amount > 0 && subtotal >= advance.threshold
      ? advance.extra_amount
      : 0;
  return advance.delivery_charge + extra;
}

export function DistrictThanaFields({
  idPrefix,
  districtField,
  thanaField,
}: {
  idPrefix: string;
  districtField: UseFormRegisterReturn;
  thanaField: UseFormRegisterReturn;
}) {
  const listId = `${idPrefix}-bd-districts`;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor={`${idPrefix}-district`}>জেলা</Label>
        <Input
          id={`${idPrefix}-district`}
          list={listId}
          placeholder="লিখুন বা বেছে নিন…"
          autoComplete="off"
          {...districtField}
          className="mt-1.5"
        />
        <datalist id={listId}>
          {BD_DISTRICTS.map((d) => (
            <option key={d.en} value={d.bn} label={d.en} />
          ))}
        </datalist>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-thana`}>থানা</Label>
        <Input id={`${idPrefix}-thana`} placeholder="যেমন: দেবিদ্বার" {...thanaField} className="mt-1.5" />
      </div>
    </div>
  );
}

export function AdvancePaymentBox({
  idPrefix,
  advance,
  subtotal,
  currency,
  last4Field,
  last4Error,
}: {
  idPrefix: string;
  advance: NonNullable<StorefrontMeta['advance_payment']>;
  subtotal: number;
  currency: string;
  last4Field: UseFormRegisterReturn;
  last4Error?: string;
}) {
  const amount = advanceAmountFor(advance, subtotal);
  if (amount <= 0) return null;

  const wallets: { key: string; label: string; number: string }[] = [
    advance.numbers.bkash ? { key: 'bkash', label: 'bKash', number: advance.numbers.bkash } : null,
    advance.numbers.nagad ? { key: 'nagad', label: 'Nagad', number: advance.numbers.nagad } : null,
    advance.numbers.rocket ? { key: 'rocket', label: 'Rocket', number: advance.numbers.rocket } : null,
  ].filter((w): w is { key: string; label: string; number: string } => w !== null);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
        <Wallet className="h-4 w-4 shrink-0" />
        অর্ডার কনফার্ম করতে অগ্রিম {formatBDT(amount, { currency })} পাঠান
      </p>
      <ul className="mt-2 space-y-1">
        {wallets.map((w) => (
          <li key={w.key} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-amber-100">
            <span className="text-xs font-semibold text-slate-700">{w.label} (Send Money)</span>
            {/* The number string straight from the API — selectable for easy copy. */}
            <span className="select-all font-mono text-sm font-bold tracking-wide text-slate-900">{w.number}</span>
          </li>
        ))}
      </ul>
      {advance.note && <p className="mt-2 text-xs text-amber-800">{advance.note}</p>}

      <div className="mt-3">
        <Label htmlFor={`${idPrefix}-adv-last4`} className="text-amber-900">
          আপনি যে নম্বর থেকে টাকা পাঠিয়েছেন বা পাঠাবেন, তার শেষের ৪ ডিজিট{' '}
          <span className="font-normal text-amber-700">(ঐচ্ছিক)</span>
        </Label>
        {/* Cap matches the server's max:32, NOT 4: shoppers routinely paste a
            full number despite the label, and the server keeps its last 4. A
            tighter cap would clip a spaced/hyphenated international number to
            the WRONG last 4 (e.g. "+880 1712-345678" → "…3456"), stranding
            auto-verify. */}
        <Input
          id={`${idPrefix}-adv-last4`}
          inputMode="numeric"
          maxLength={32}
          placeholder="যেমন: ৪৬৭১"
          autoComplete="off"
          {...last4Field}
          className="mt-1.5 bg-white"
        />
        {last4Error && <p className="mt-1 text-xs text-rose-600">{last4Error}</p>}
        <p className="mt-1.5 text-[11px] leading-relaxed text-amber-700">
          এখনই না পাঠালেও সমস্যা নেই — ডিজিটগুলো দিয়ে রাখুন, টাকা পৌঁছালে আমরা মিলিয়ে অর্ডার কনফার্ম করে দেব।
        </p>
      </div>
    </div>
  );
}
