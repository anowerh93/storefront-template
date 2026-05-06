'use client';

import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Sticky floating Messenger CTA — bottom-right on mobile, bottom-right on
 * desktop. Always visible while the user browses. Strong conversion lever
 * in the BD market where shoppers expect to negotiate / ask questions
 * before buying.
 *
 * The href is the m.me deep link returned by GET /storefronts/{slug}/messenger-link
 * (or null if the tenant hasn't connected a Page yet — in which case the
 * CTA is hidden).
 */
export function MessengerCTA({ href }: { href: string | null }) {
  if (!href) return null;

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full
                 bg-[#0084FF] text-white shadow-lg hover:bg-[#0073E0] transition-colors
                 sm:bottom-6 sm:right-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, type: 'spring', stiffness: 200, damping: 20 }}
      aria-label="Chat with us on Messenger"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="text-sm font-semibold hidden sm:inline">Chat with us</span>
    </motion.a>
  );
}
