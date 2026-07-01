import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors',
  {
    variants: {
      variant: {
        default:    'bg-slate-100 text-slate-700 border-slate-200',
        brand:      'bg-brand-50 text-brand-700 border-brand-200',
        success:    'bg-brand-50 text-brand-700 border-brand-200',
        warning:    'bg-amber-50 text-amber-700 border-amber-200',
        danger:     'bg-rose-50 text-rose-700 border-rose-200',
        outline:    'bg-transparent text-slate-700 border-slate-200',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
