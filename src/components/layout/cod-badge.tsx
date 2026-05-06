import { Truck } from 'lucide-react';
import { Badge } from '../ui/badge';

/**
 * "Cash on Delivery" badge — Bangladesh market trust signal. Visible on
 * every PDP above the fold and on every checkout step.
 */
export function CodBadge({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  if (size === 'lg') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 w-fit">
        <Truck className="h-4 w-4 text-emerald-700" />
        <span className="text-sm font-semibold text-emerald-800">Cash on Delivery available</span>
      </div>
    );
  }
  return (
    <Badge variant="success">
      <Truck className="h-3 w-3" />
      Cash on Delivery
    </Badge>
  );
}
