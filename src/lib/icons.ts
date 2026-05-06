/**
 * Icon name → Lucide component lookup. Used by sections whose icons are
 * config-driven from the dashboard (trust badges, services row).
 *
 * Keep in sync with HomepageConfig::TRUST_ICONS in Laravel — that's the
 * allowlist the dashboard form can pick from.
 */

import {
  Truck, Headphones, RefreshCw, ShieldCheck,
  Package, CreditCard, Globe, Gift,
  ThumbsUp, Award, Clock, Phone,
  MessageCircle, Heart, Sparkles, BadgeCheck,
  HelpCircle,
} from 'lucide-react';

const REGISTRY: Record<string, React.ComponentType<{ className?: string }>> = {
  'truck':         Truck,
  'headphones':    Headphones,
  'refresh-cw':    RefreshCw,
  'shield-check':  ShieldCheck,
  'package':       Package,
  'credit-card':   CreditCard,
  'globe':         Globe,
  'gift':          Gift,
  'thumbs-up':     ThumbsUp,
  'award':         Award,
  'clock':         Clock,
  'phone':         Phone,
  'message-circle':MessageCircle,
  'heart':         Heart,
  'sparkles':      Sparkles,
  'badge-check':   BadgeCheck,
  'help-circle':   HelpCircle,
};

export function getIcon(name: string): React.ComponentType<{ className?: string }> {
  return REGISTRY[name] ?? Package; // safe fallback — never explodes the page
}
