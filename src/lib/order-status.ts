/**
 * Customer-facing order status → display label + badge variant.
 *
 * The order API also returns a `status_label`, but that field carries INTERNAL
 * ops jargon meant for the merchant dashboard ("Pending (needs call)",
 * "Verified · On hold", "Awaiting verification") — it must NEVER be shown to
 * shoppers. Always map the raw `status` to friendly copy through here instead.
 *
 * The pre-confirmation internal states (draft / awaiting_verification / pending
 * / on_hold) all collapse to a single "Processing" so a shopper just sees that
 * their order is being handled. Keys match App\Models\Order::STATUS_* exactly —
 * note 'canceled' is one L.
 */
export type OrderStatusVariant = 'default' | 'success' | 'warning' | 'brand';

const STATUS_MAP: Record<string, { label: string; variant: OrderStatusVariant }> = {
  draft:                 { label: 'Processing', variant: 'brand' },
  awaiting_verification: { label: 'Processing', variant: 'brand' },
  // Online order whose gateway payment hasn't been confirmed yet — the order
  // page shows a live "Confirming your payment…" banner alongside this badge.
  awaiting_payment:      { label: 'Awaiting Payment', variant: 'warning' },
  pending:               { label: 'Processing', variant: 'brand' },
  on_hold:               { label: 'Processing', variant: 'brand' },
  confirmed:             { label: 'Confirmed',  variant: 'brand' },
  shipped:               { label: 'Shipped',    variant: 'brand' },
  delivered:             { label: 'Delivered',  variant: 'success' },
  canceled:              { label: 'Canceled',   variant: 'default' },
};

/** Humanize an unknown status string ("foo_bar" → "Foo Bar"). */
function humanize(s: string): string {
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Order';
}

export function customerStatus(status: string): { label: string; variant: OrderStatusVariant } {
  return STATUS_MAP[status] ?? { label: humanize(status), variant: 'default' };
}
