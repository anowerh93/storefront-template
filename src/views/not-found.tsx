import { Button } from '../components/ui/button';

export function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-xs uppercase tracking-wider font-semibold text-brand-600 mb-2">404</p>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Page not found</h1>
      <p className="text-sm text-slate-600 mb-6 max-w-md">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <div className="flex gap-3">
        <a href="/"><Button variant="brand">Go home</Button></a>
        <a href="/products"><Button variant="outline">Browse products</Button></a>
      </div>
    </div>
  );
}
