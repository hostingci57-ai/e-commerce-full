import type { MetadataRoute } from 'next';

export const revalidate = 300;

/**
 * robots.txt — when the tenant has configured a custom payload (via
 * /v1/public/seo/settings → robotsTxt) we defer to Next's raw string support
 * by returning a single "rules" entry that Next flattens verbatim. For the
 * default case we emit a conservative allowlist + sitemap reference.
 */
export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_STOREFRONT_URL?.replace(/\/$/, '') ??
    'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/checkout', '/account', '/cart'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
