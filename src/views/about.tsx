import { getStorefront } from '../lib/api';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { MessengerCTA } from '../components/layout/messenger-cta';
import { Button } from '../components/ui/button';

export async function AboutPage() {
  const meta = await getStorefront();
  return (
    <>
      <Header meta={meta} />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">{meta.name}</h1>
        {meta.about ? (
          <div className="prose prose-slate max-w-none mt-6">
            <p className="text-base text-slate-700 leading-relaxed whitespace-pre-line">{meta.about}</p>
          </div>
        ) : (
          <p className="text-slate-500 mt-4">More about us coming soon.</p>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <a href="/products"><Button variant="brand">Shop our products</Button></a>
          {meta.messenger?.url && (
            <a href={meta.messenger.url} target="_blank" rel="noopener">
              <Button variant="outline">Get in touch</Button>
            </a>
          )}
        </div>
      </main>
      <Footer meta={meta} />
      <MessengerCTA href={meta.messenger?.url ?? null} />
    </>
  );
}
