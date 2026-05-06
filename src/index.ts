/**
 * Public exports of the @replybd/storefront-template package.
 *
 * The thin tenant shell typically only re-exports Page + Layout + revalidate.
 * Anything additional surfaced here lets advanced tenants compose their own
 * pages / sections by importing primitives directly.
 */

export { Page, generateMetadata, generateStaticParams } from './page';
export { Layout } from './layout';
export { POST, GET } from './revalidate';

// Pages (for advanced composition)
export { HomePage } from './views/home';
export { ProductListPage } from './views/product-list';
export { ProductDetailPage } from './views/product-detail';
export { CategoryListPage } from './views/category-list';
export { CategoryDetailPage } from './views/category-detail';
// Cart and checkout are no longer part of the template — orders go via
// the inline OrderNowForm on the product detail page.
export { OrderLookupPage } from './views/order-lookup';
export { OrderStatusPage } from './views/order-status';
export { AboutPage } from './views/about';

// Components — handy for tenant overrides.
export { Header } from './components/layout/header';
export { Footer } from './components/layout/footer';
export { MessengerCTA } from './components/layout/messenger-cta';
export { CodBadge } from './components/layout/cod-badge';
export { ProductCard } from './components/product/product-card';
export { ProductGrid } from './components/product/product-grid';
export { OrderNowForm } from './components/product/order-now-form';

// Lib
export * from './lib/types';
export * from './lib/api';
export * from './lib/format';
export * from './lib/pixel';
export { brandCssVars } from './lib/theme';
