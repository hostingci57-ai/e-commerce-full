import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { getTenantSlug } from '@/lib/tenant-context';
import { renderCmsContent } from '@/lib/cms-render';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tenantSlug = await getTenantSlug();
  try {
    const page = await api.cms.getPage(slug, { tenantSlug });
    return {
      title: page.metaTitle ?? page.title,
      description: page.metaDescription ?? undefined,
      openGraph: {
        title: page.metaTitle ?? page.title,
        description: page.metaDescription ?? undefined,
        type: 'article',
      },
    };
  } catch {
    return { title: 'Sayfa bulunamadı' };
  }
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const tenantSlug = await getTenantSlug();

  const page = await api.cms.getPage(slug, { tenantSlug }).catch(() => null);
  if (!page) notFound();

  return (
    <article className="container mx-auto max-w-3xl py-10">
      <header className="mb-6 border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-bold text-slate-900">{page.title}</h1>
        {page.publishedAt ? (
          <p className="mt-2 text-xs text-slate-500">
            {new Date(page.publishedAt).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        ) : null}
      </header>
      <div
        className="prose prose-slate max-w-none prose-a:text-brand-700 prose-headings:text-slate-900"
        dangerouslySetInnerHTML={{ __html: renderCmsContent(page.content) }}
      />
    </article>
  );
}
