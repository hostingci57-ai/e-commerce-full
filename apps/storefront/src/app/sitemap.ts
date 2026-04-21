import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';

export const revalidate = 300; // 5min

/**
 * Dynamic sitemap. Pulls the XML from the API (which aggregates products,
 * categories, and CMS pages for the active tenant) and re-emits the entries
 * as Next MetadataRoute.Sitemap. If the API call fails we fall back to a
 * minimal static list so the route never 500s in production.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_STOREFRONT_URL?.replace(/\/$/, '') ??
    'http://localhost:3000';
  const now = new Date();

  try {
    // Products (active) + categories + CMS pages — one call each, cached 5min.
    const [products, pages] = await Promise.all([
      api.products
        .list({ pageSize: 100, sort: 'newest' }, { revalidate: 300 })
        .catch(() => ({ items: [] })),
      api.cms.listPages(undefined, { revalidate: 300 }).catch(() => [] as Array<{
        slug: string;
        updatedAt: string;
      }>),
    ]);

    const entries: MetadataRoute.Sitemap = [
      { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
      {
        url: `${base}/products`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.9,
      },
    ];

    for (const p of (products as { items: { slug: string; updatedAt?: string }[] })
      .items ?? []) {
      entries.push({
        url: `${base}/products/${p.slug}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    for (const pg of pages as { slug: string; updatedAt: string }[]) {
      entries.push({
        url: `${base}/p/${pg.slug}`,
        lastModified: pg.updatedAt ? new Date(pg.updatedAt) : now,
        changeFrequency: 'monthly',
        priority: 0.5,
      });
    }

    return entries;
  } catch {
    return [
      { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
      {
        url: `${base}/products`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.9,
      },
    ];
  }
}
