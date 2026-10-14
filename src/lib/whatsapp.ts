/**
 * The প্রবাসী (expat) shopper's optional WhatsApp number on the checkout and
 * the funnel order form — read EXACTLY as the API reads it
 * (App\Support\WhatsAppNumber::normalize in myapp). Change the two together:
 * a number this lets through and the API refuses costs the shopper a 422 and
 * one of the five orders an hour their phone may place.
 *
 * A number is international only when it says so (a leading "+" or "00").
 * Without that it can only be a Bangladeshi mobile — "0501234567" is a UAE
 * number to whoever typed it, and nothing a wa.me link could reach.
 */

/** What the API answers (`invalid_whatsapp`) and the field shows. */
export const WHATSAPP_INVALID = 'হোয়াটসঅ্যাপ নাম্বারটি দেশের কোডসহ লিখুন, যেমন +971 50 123 4567';

// Bengali, Arabic-Indic and Persian digits — a Gulf phone types the last two.
const LOCAL_DIGITS = /[০-৯٠-٩۰-۹]/g;
const localDigit = (d: string): string => {
  const c = d.charCodeAt(0);
  if (c >= 0x09e6 && c <= 0x09ef) return String(c - 0x09e6);
  if (c >= 0x0660 && c <= 0x0669) return String(c - 0x0660);
  return String(c - 0x06f0);
};

// Marks a COPIED number carries without showing them (direction marks from
// WhatsApp's and Android's contacts, zero-width characters) — dropped wherever
// they stand.
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

// Spelled out, never \s: the PHP side's \s is ASCII-only, JavaScript's is not.
const EDGE_SPACE = /^[ \t\n\x0B\f\r ]+|[ \t\n\x0B\f\r ]+$/g;
const TYPED = /^\+?[0-9 \t\n\x0B\f\r().\- ‐-―−]+$/;

// Country codes after which people write their own trunk "0" ("+971 050 …",
// "+44 (0)7700 …") and whose national numbers never start with 0 — that 0 is
// dropped (wa.me refuses the number with it). Italy and the others whose
// numbers can start with 0 are not listed. Same list as the PHP side.
const TRUNK_ZERO_COUNTRIES = [
  '7', '20', '27', '30', '31', '32', '33', '34', '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98',
  '212', '213', '216', '218', '230', '233', '234', '249', '254', '255', '256', '351', '353', '358',
  '673', '960', '961', '962', '963', '964', '965', '966', '967', '968', '971', '973', '974', '977',
];

function cleaned(raw: string | null | undefined): string {
  return (raw ?? '').replace(LOCAL_DIGITS, localDigit).replace(INVISIBLE, '').replace(EDGE_SPACE, '');
}

/** True for what the order should treat as "no number": blank, invisible marks only, or a lone "+". */
export function isBlankWhatsApp(raw: string | null | undefined): boolean {
  const v = cleaned(raw);
  return v === '' || v === '+';
}

/** Digits with the country code ("971501234567"), or null when unreadable. */
export function normalizeWhatsApp(raw: string | null | undefined): string | null {
  const value = cleaned(raw);
  if (value === '' || !TYPED.test(value)) return null;

  let international = value.startsWith('+');
  let digits = value.replace(/\D+/g, '');
  if (!international && digits.startsWith('00')) {
    international = true;
    digits = digits.slice(2);
  }

  // Bangladesh, written any of the ways it is written; after a "+" only with
  // the country code.
  const bd = /^(?:0|880?0?)?(1[3-9]\d{8})$/.exec(digits);
  if (bd && (!international || digits.startsWith('88'))) return '880' + bd[1];

  if (!international) return null;

  const code = TRUNK_ZERO_COUNTRIES.find((c) => digits.startsWith(c + '0'));
  if (code !== undefined) digits = code + digits.slice(code.length + 1);

  const n = digits.length;
  if (n < 8 || n > 15 || digits[0] === '0' || digits.startsWith('880') || (digits[0] === '1' && n !== 11)) {
    return null;
  }
  return digits;
}
