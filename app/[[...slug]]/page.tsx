// Dev-only catch-all — re-exports the package's Page so /, /products, /products/foo
// etc. all render via the package's router during local development.
export { Page as default, generateMetadata, generateStaticParams } from '../../src/page';
