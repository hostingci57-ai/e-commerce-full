import { Injectable, Logger } from '@nestjs/common';
import { withTenant } from '@ecf/db';
import type { Prisma } from '@ecf/db';

/**
 * Default content seeded at tenant creation: About / Privacy Policy / Terms,
 * plus main + footer menus. Idempotent — all writes are upserts.
 */
@Injectable()
export class CmsSeedService {
  private readonly logger = new Logger(CmsSeedService.name);

  async seedDefaults(tenantId: string): Promise<void> {
    await withTenant({ tenantId }, async (tx) => {
      const now = new Date();
      const pages: Array<{
        slug: string;
        title: string;
        content: string;
        metaTitle: string;
        metaDescription: string;
        showInFooter: boolean;
        sortOrder: number;
      }> = [
        {
          slug: 'hakkimizda',
          title: 'Hakkımızda',
          content:
            '# Hakkımızda\n\nMağazamızı ziyaret ettiğiniz için teşekkür ederiz. ' +
            'Bu sayfayı tenant paneli üzerinden düzenleyerek markanızın hikâyesini ekleyebilirsiniz.\n',
          metaTitle: 'Hakkımızda',
          metaDescription: 'Mağazamız ve markamız hakkında bilgi alın.',
          showInFooter: true,
          sortOrder: 10,
        },
        {
          slug: 'gizlilik-politikasi',
          title: 'Gizlilik Politikası',
          content:
            '# Gizlilik Politikası\n\nBu sayfada kişisel verilerin işlenmesine ilişkin politikanız yer alır. ' +
            'KVKK aydınlatma metninizi tenant panelinden düzenleyebilirsiniz.\n',
          metaTitle: 'Gizlilik Politikası',
          metaDescription: 'Kişisel verilerin işlenmesine ilişkin politika.',
          showInFooter: true,
          sortOrder: 20,
        },
        {
          slug: 'kullanim-sartlari',
          title: 'Kullanım Şartları',
          content:
            '# Kullanım Şartları\n\nMağazamızı kullanırken uyulması gereken şartlar bu sayfada yer alır. ' +
            'İade/iptal kurallarınızı tenant panelinden düzenleyebilirsiniz.\n',
          metaTitle: 'Kullanım Şartları',
          metaDescription: 'Kullanım şartları ve iade politikası.',
          showInFooter: true,
          sortOrder: 30,
        },
      ];
      for (const p of pages) {
        await tx.cmsPage.upsert({
          where: { tenantId_slug: { tenantId, slug: p.slug } },
          update: {
            // Only fill in missing metadata on re-seed — don't clobber tenant edits.
            metaTitle: p.metaTitle,
            metaDescription: p.metaDescription,
            showInFooter: p.showInFooter,
          },
          create: {
            tenantId,
            slug: p.slug,
            title: p.title,
            content: p.content,
            metaTitle: p.metaTitle,
            metaDescription: p.metaDescription,
            isPublished: true,
            publishedAt: now,
            showInFooter: p.showInFooter,
            showInHeader: false,
            sortOrder: p.sortOrder,
          },
        });
      }

      const defaultMainItems = [
        { label: 'Tüm Ürünler', type: 'url', target: '/products', sortOrder: 0 },
      ];
      const defaultFooterItems = [
        { label: 'Hakkımızda', type: 'page', target: 'hakkimizda', sortOrder: 0 },
        { label: 'Gizlilik', type: 'page', target: 'gizlilik-politikasi', sortOrder: 10 },
        { label: 'Şartlar', type: 'page', target: 'kullanim-sartlari', sortOrder: 20 },
      ];

      await tx.cmsMenu.upsert({
        where: { tenantId_key: { tenantId, key: 'main' } },
        update: {},
        create: {
          tenantId,
          key: 'main',
          name: 'Ana Menü',
          items: defaultMainItems as Prisma.InputJsonValue,
          isActive: true,
        },
      });
      await tx.cmsMenu.upsert({
        where: { tenantId_key: { tenantId, key: 'footer' } },
        update: {},
        create: {
          tenantId,
          key: 'footer',
          name: 'Footer',
          items: defaultFooterItems as Prisma.InputJsonValue,
          isActive: true,
        },
      });
      this.logger.log(`CMS defaults seeded for tenant ${tenantId}`);
    });
  }
}
