import Link from 'next/link';
import type { Category } from '@/lib/types';

export function Nav({ categories }: { categories: Category[] }) {
  if (!categories?.length) return null;
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="container flex gap-6 overflow-x-auto py-2 text-sm text-slate-700">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/c/${c.slug}`}
            className="whitespace-nowrap hover:text-brand-700"
          >
            {c.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
