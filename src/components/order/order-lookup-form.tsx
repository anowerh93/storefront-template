'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

export function OrderLookupForm({ orderNumber: initialNumber = '' }: { orderNumber?: string }) {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState(initialNumber);
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = (initialNumber || orderNumber.trim().length > 0) && phone.length === 4;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const num = (initialNumber || orderNumber).trim();
    router.push(`/order/${encodeURIComponent(num)}?phone=${encodeURIComponent(phone.slice(-4))}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
      {!initialNumber && (
        <div>
          <Label htmlFor="order_number">Order number</Label>
          <Input
            id="order_number"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. ABC123"
            className="mt-1.5"
            autoComplete="off"
            required
          />
        </div>
      )}
      <div>
        <Label htmlFor="phone">Last 4 digits of your phone</Label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          placeholder="1234"
          className="mt-1.5 font-mono tracking-widest text-center text-lg"
          required
        />
      </div>
      <Button type="submit" variant="brand" className="w-full" disabled={!canSubmit || submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking up…
          </>
        ) : (
          'Look up order'
        )}
      </Button>
    </form>
  );
}
