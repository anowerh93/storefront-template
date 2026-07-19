/**
 * Build a wa.me deep link from a tenant-entered WhatsApp number.
 *
 * wa.me requires the FULL international number with no "+", "00" or leading
 * local zero — but BD tenants almost always type the local 01XXXXXXXXX form,
 * which as-is produces a dead wa.me link. Convert local BD mobiles to 8801…;
 * pass through anything already in international form; reject obvious junk.
 */
export function waHref(number: string | null | undefined): string | null {
  if (!number) return null;
  let digits = number.replace(/\D+/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^01[3-9]\d{8}$/.test(digits)) digits = '880' + digits.slice(1);
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}
