import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind class merger — the standard shadcn helper. Combines clsx for
 * conditional classes and twMerge to drop conflicting Tailwind utilities
 * (so `cn('p-4', condition && 'p-2')` ends up as just `p-2`).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
