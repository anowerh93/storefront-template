// Dev-only layout — re-exports the package's Layout so `npm run dev`
// boots the same UI a tenant would see. Tenants don't use this file.
export { Layout as default, generateMetadata } from '../src/layout';
