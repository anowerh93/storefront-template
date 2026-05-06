# @replybd/storefront-template

Headless storefront template for [Reply.BD](https://reply.bd) tenants.
Next.js 15 · Tailwind v4 · shadcn/ui · TypeScript.

Each tenant's deployed Vercel project is a thin shell (~10 files) that
imports from this package, so the visual storefront updates centrally
when we ship a new version.

## Architecture

```
┌─────────────────────────────────────┐
│  Tenant's Vercel project (~10 files)│  → Imports @replybd/storefront-template
│   • app/[[...slug]]/page.tsx        │
│   • app/api/revalidate/route.ts     │
│   • app/layout.tsx                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  THIS PACKAGE                       │
│   • <Page />     catch-all router   │
│   • <Layout />   theme + pixel      │
│   • POST /revalidate                │
│   • All pages, components, types    │
└──────────────┬──────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────┐
│  Reply.BD Laravel API               │
│   /api/v1/storefronts/{slug}/...    │
└─────────────────────────────────────┘
```

## Pages shipped

| Route | What it renders |
|---|---|
| `/` | Hero · featured products · categories strip · trust bar |
| `/products` | Paginated grid · search · category filter · mobile chips |
| `/products/[slug]` | PDP — auto-switches between standard layout and funnel mode based on the API's `funnel` payload |
| `/categories` | Category index |
| `/categories/[slug]` | Category detail with paginated products |
| `/checkout` | Single-page COD checkout (phone/name/address/zone + Turnstile-ready) |
| `/order/lookup` | Customer-facing order tracker |
| `/order/[number]` | Order status + items + totals |
| `/about` | Brand story (pulls `users.storefront_about`) |
| `/api/revalidate` | ISR webhook receiver — validates `X-Revalidate-Secret`, calls `revalidatePath` + `revalidateTag` |

## BD-market UX baked in

- BDT formatting everywhere (`৳1,299` with en-IN comma grouping)
- COD badge above the fold on PDPs
- Free-shipping threshold progress bar in cart
- Two shipping zones (inside/outside city)
- Sticky Messenger CTA (mobile bottom-right floating)
- Phone-first — no signup, order lookup by last-4 phone digits
- No card payments — COD flow only
- Mobile-first design budget

## Meta Pixel events fired client-side

`PageView` (in `Layout`), `ViewContent` (PDP), `AddToCart`, `InitiateCheckout`, `Purchase`. Server-side CAPI continues from Laravel using `fb_capi_token` (which is never exposed to the browser).

## Local dev

```bash
cp .env.local.example .env.local
# edit .env.local — point at your local Reply.BD instance
npm install
npm run dev
```

The package can be developed as a standalone Next.js app via `app/` (which
re-exports the same entries as the published package would).

### Environment variables (set by the deploy flow on Vercel)

```
NEXT_PUBLIC_API_BASE          # e.g. https://reply.bd
NEXT_PUBLIC_STOREFRONT_SLUG   # tenant's storefront_slug
REVALIDATE_SECRET             # matches users.revalidate_secret in Laravel
```

## Package layout

```
src/
  index.ts                  Public exports
  page.tsx                  Catch-all router (delegates to pages/)
  layout.tsx                Root layout — theme + pixel + fonts
  revalidate.ts             ISR webhook handler
  styles.css                Tailwind v4 @theme + base styles
  lib/
    api.ts                  fetch wrappers, ISR-tagged
    types.ts                TS types matching the Laravel API contract
    format.ts               BDT formatter, discount %, relative time
    cart.ts                 zustand cart store with localStorage persist
    pixel.ts                Meta Pixel client-side event helpers
    theme.ts                Brand-color → CSS variable injection
    utils.ts                cn() Tailwind class merger
  components/
    ui/                     shadcn-style primitives (button, badge, sheet, …)
    layout/                 header, footer, messenger-cta, cod-badge
    product/                product-card, product-grid, add-to-cart-block
    cart/                   cart-drawer
    checkout/               checkout-client (the form)
    order/                  order-lookup-form
  pages/                    page components composed by src/page.tsx
app/                        Dev-only shell — re-exports from src/ so
                            `npm run dev` boots the same UI a tenant would see.
```

## Updating a deployed tenant

1. Bump `version` in this package's `package.json`
2. `npm publish`
3. In the Reply.BD dashboard, each tenant clicks "Update template" → Vercel rebuilds against the latest `npm install`

## License

UNLICENSED. Internal Reply.BD project.
