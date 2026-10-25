import { BadgeCheck, ClipboardList, PackageCheck, Truck, X } from 'lucide-react';
import type { OrderResponse } from '../../lib/types';

/**
 * Where the order stands, as a row of milestones with an icon each —
 * Order placed → Confirmed → Shipped → Delivered — instead of the plain
 * "Status: Processing" text a shopper had to read before (Oct 2026, asked for
 * by the ZamZam shop too). Horizontal on a wide screen, a vertical rail on a
 * phone. Pure: `progressSteps()` works the steps out from the order alone so
 * the mapping can be read (and checked) without rendering.
 *
 * The API's `timeline` carries the recorded fulfilment events (confirmed /
 * shipped / delivered / canceled, latest per status — Order::customerTimeline);
 * placement is `placed_at`. The steps follow the order's STATUS, the timeline
 * only dates them: a store that moved an order back (shipped → confirmed)
 * shows Shipped as upcoming again, whatever the events say.
 */

export type StepState = 'done' | 'current' | 'upcoming' | 'canceled';

export type ProgressStep = {
  key: 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'canceled';
  title: string;
  /** What the step means right now; '' for an upcoming one (title only). */
  description: string;
  /** ISO timestamp, when the step has happened. */
  at?: string;
  state: StepState;
};

/** The fulfilment milestones after placement, in order. */
const MILESTONES = ['confirmed', 'shipped', 'delivered'] as const;
type Milestone = (typeof MILESTONES)[number];

/** How far an order's status has come along MILESTONES (0 = not confirmed yet). */
function reached(status: string): number {
  const i = MILESTONES.indexOf(status as Milestone);
  return i === -1 ? 0 : i + 1;
}

const DONE_COPY: Record<Milestone, string> = {
  confirmed: 'We’ve confirmed your order.',
  shipped: 'Your order is on the way.',
  delivered: 'You have received your order.',
};

/** What the shop is doing while this is the NEXT step. */
function currentCopy(step: Milestone, status: string): string {
  if (step === 'confirmed') {
    return status === 'awaiting_payment'
      ? 'Waiting for your payment to be confirmed.'
      : 'We are confirming your order.';
  }
  if (step === 'shipped') return 'Your order is being prepared for dispatch.';
  return 'Your order is on its way to you.';
}

const TITLES: Record<ProgressStep['key'], string> = {
  placed: 'Order Placed',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  canceled: 'Canceled',
};

export function progressSteps(order: Pick<OrderResponse, 'status' | 'placed_at' | 'timeline'>): ProgressStep[] {
  const at: Partial<Record<string, string>> = {};
  for (const t of order.timeline ?? []) {
    if (t?.status && t.at) at[t.status] = t.at;
  }

  const steps: ProgressStep[] = [
    { key: 'placed', title: TITLES.placed, description: 'We have received your order.', at: order.placed_at, state: 'done' },
  ];

  if (order.status === 'canceled') {
    // Everything the order got to before it was canceled stays ticked (the
    // furthest recorded milestone and the ones before it); the rest is
    // replaced by the one red step. A canceled order never shows "upcoming".
    const got = Math.max(0, ...MILESTONES.map((m, i) => (at[m] ? i + 1 : 0)));
    for (const m of MILESTONES.slice(0, got)) {
      steps.push({ key: m, title: TITLES[m], description: DONE_COPY[m], at: at[m], state: 'done' });
    }
    steps.push({
      key: 'canceled',
      title: TITLES.canceled,
      description: 'Your order has been canceled.',
      at: at.canceled,
      state: 'canceled',
    });
    return steps;
  }

  const done = reached(order.status);
  MILESTONES.forEach((m, i) => {
    const state: StepState = i < done ? 'done' : i === done ? 'current' : 'upcoming';
    steps.push({
      key: m,
      title: TITLES[m],
      description: state === 'done' ? DONE_COPY[m] : state === 'current' ? currentCopy(m, order.status) : '',
      at: state === 'done' ? at[m] : undefined,
      state,
    });
  });

  return steps;
}

const ICONS: Record<ProgressStep['key'], typeof Truck> = {
  placed: ClipboardList,
  confirmed: BadgeCheck,
  shipped: Truck,
  delivered: PackageCheck,
  canceled: X,
};

/** ISO → "25 Oct 2026, 1:26 PM". Empty when unusable. */
function when(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

const CIRCLE: Record<StepState, string> = {
  done: 'bg-emerald-500 text-white',
  current: 'bg-brand-600 text-white ring-4 ring-brand-600/15',
  upcoming: 'bg-slate-100 text-slate-400',
  canceled: 'bg-rose-500 text-white',
};

export function OrderProgress({ order }: { order: Pick<OrderResponse, 'status' | 'placed_at' | 'timeline'> }) {
  const steps = progressSteps(order);
  const current = steps.find((s) => s.state === 'current') ?? steps.find((s) => s.state === 'canceled');

  return (
    <div>
      {/* One line a shopper can read without the picture — also what a screen
          reader gets first. */}
      {current && (
        <p className="sr-only">
          {current.state === 'canceled' ? current.description : `Next: ${current.title}. ${current.description}`}
        </p>
      )}
      <ol className="flex flex-col sm:flex-row sm:items-start" data-order-progress>
        {steps.map((step, i) => {
          const Icon = ICONS[step.key];
          const last = i === steps.length - 1;
          const prev = steps[i - 1];
          // The line INTO this step is coloured once the step before it is done.
          const lineIn = prev?.state === 'done' ? (step.state === 'canceled' ? 'bg-rose-300' : 'bg-emerald-500') : 'bg-slate-200';
          // The line OUT of this step (phone rail) is the next step's line in.
          const next = steps[i + 1];
          const lineOut = step.state === 'done' ? (next?.state === 'canceled' ? 'bg-rose-300' : 'bg-emerald-500') : 'bg-slate-200';
          const muted = step.state === 'upcoming';
          const time = when(step.at);

          return (
            <li
              key={step.key}
              className="relative flex gap-4 sm:flex-1 sm:flex-col sm:items-center sm:gap-0 sm:text-center"
              data-step={step.key}
              data-state={step.state}
              aria-current={step.state === 'current' ? 'step' : undefined}
            >
              {/* Wide screens: the connector from the previous step's icon. */}
              {i > 0 && (
                <span aria-hidden="true" className={`absolute left-[-50%] right-1/2 top-5 hidden h-0.5 sm:block ${lineIn}`} />
              )}

              {/* Icon, and on a phone the rail down to the next step. */}
              <div className="flex shrink-0 flex-col items-center">
                <span className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${CIRCLE[step.state]}`}>
                  <Icon className="h-5 w-5" strokeWidth={step.state === 'canceled' ? 3 : 2} aria-hidden="true" focusable="false" />
                </span>
                {!last && <span aria-hidden="true" className={`mt-1 w-0.5 flex-1 ${lineOut} sm:hidden`} />}
              </div>

              <div className={`min-w-0 flex-1 sm:mt-3 sm:px-1 ${last ? 'pb-0' : 'pb-7 sm:pb-0'}`}>
                <p className={`font-semibold ${muted ? 'text-slate-400' : step.state === 'canceled' ? 'text-rose-700' : 'text-slate-900'}`}>
                  {step.title}
                </p>
                {time && <p className="mt-0.5 text-xs text-slate-500 tabular-nums">{time}</p>}
                {step.description && (
                  <p className={`mt-1 text-sm ${step.state === 'current' ? 'text-slate-600' : 'text-slate-500'}`}>{step.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
