import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import { getStorefront } from './lib/api';
import { brandCssVars } from './lib/theme';
import './styles.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const meta = await getStorefront();
    return {
      title: {
        default: meta.seo.title ?? meta.name,
        template: `%s — ${meta.name}`,
      },
      description: meta.seo.description ?? meta.about ?? meta.name,
      openGraph: {
        title: meta.seo.title ?? meta.name,
        description: meta.seo.description ?? meta.about ?? undefined,
        images: meta.seo.og_image ? [{ url: meta.seo.og_image }] : undefined,
        siteName: meta.name,
      },
      icons: meta.logo_url ? [{ rel: 'icon', url: meta.logo_url }] : undefined,
    };
  } catch {
    return { title: 'Storefront', description: 'Loading…' };
  }
}

/**
 * Root layout — fetches storefront metadata once at the layout level so
 * the brand color, fonts, pixel script, and viewport meta are all set up
 * before any page renders.
 *
 * Re-exported by the thin shell as `app/layout.tsx`.
 */
export async function Layout({ children }: { children: React.ReactNode }) {
  let meta;
  try {
    meta = await getStorefront();
  } catch {
    meta = null;
  }

  const brandStyle = meta ? brandCssVars(meta.theme_color) : '';

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Brand color CSS variables — server-rendered, no flash. */}
        {brandStyle && (
          <style
            dangerouslySetInnerHTML={{
              __html: `:root { ${brandStyle} }`,
            }}
          />
        )}

        {/* Meta Pixel — fires PageView on initial load. Per-event firing is
            done client-side in components via lib/pixel.ts. */}
        {meta?.pixel.id && (
          <Script id="fbq-init" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta.pixel.id}');fbq('track','PageView');`}
          </Script>
        )}
      </head>
      <body className="bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}

export default Layout;
