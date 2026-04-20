import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'http://localhost:3000';
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/register`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
