/** @type {import('next').NextConfig} */
const nextConfig = {
  // Reply.BD storefronts often serve images from Cloudflare R2 or the Laravel
  // app's public disk — we don't know the host at build time, so allow any
  // remote image. The thin shell can override this if the tenant wants to
  // tighten it.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },

  // Lets Tailwind v4 + Next.js 15 transpile our package's source TSX directly
  // when consumed via the thin shell.
  transpilePackages: ['@replybd/storefront-template'],

  // SPA-style page transitions feel snappier on mobile (BD's primary device).
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
