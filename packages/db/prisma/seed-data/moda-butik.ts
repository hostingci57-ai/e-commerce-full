/**
 * Demo tenant #2 — "Moda Butik" (Starter plan).
 *
 * 1 brand · apparel categories · 15 products with color+size variants
 * 5 customers · 5 orders · 1 coupon (PERCENT 20).
 */

import type { DemoTenantSpec } from './types';

const brands = [{ slug: 'butik', name: 'Butik' }] as const;

const categories = [
  { slug: 'kadin', name: 'Kadın', parent: null, position: 0 },
  { slug: 'kadin-ustgiyim', name: 'Üst Giyim', parent: 'kadin', position: 0 },
  { slug: 'kadin-altgiyim', name: 'Alt Giyim', parent: 'kadin', position: 1 },
  { slug: 'kadin-elbise', name: 'Elbise', parent: 'kadin', position: 2 },
  { slug: 'erkek', name: 'Erkek', parent: null, position: 1 },
  { slug: 'erkek-ustgiyim', name: 'Üst Giyim', parent: 'erkek', position: 0 },
  { slug: 'erkek-altgiyim', name: 'Alt Giyim', parent: 'erkek', position: 1 },
  { slug: 'cocuk', name: 'Çocuk', parent: null, position: 2 },
  { slug: 'cocuk-giyim', name: 'Giyim', parent: 'cocuk', position: 0 },
] as const;

type ProductSpec = {
  slug: string;
  title: string;
  description: string;
  brand: string | null;
  categorySlugs: string[];
  variants: Array<{
    sku: string;
    priceMinorUnits: bigint;
    compareAtMinorUnits?: bigint;
    stockOnHand: number;
    optionValue?: string;
  }>;
  optionName?: string;
  mediaSeed: string;
};

const TRY_ = (tl: number): bigint => BigInt(tl * 100);

const products: ProductSpec[] = [
  // Kadın üst giyim
  {
    slug: 'kadin-basic-tshirt',
    title: 'Kadın Basic Pamuklu Tişört',
    description: '%100 pamuk, bisiklet yaka, oversize kalıp. Günlük şık kullanıma uygun.',
    brand: 'butik',
    categorySlugs: ['kadin-ustgiyim'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-KT-TS-WHT-S', priceMinorUnits: TRY_(199), stockOnHand: 50, optionValue: 'Beyaz / S' },
      { sku: 'MB-KT-TS-WHT-M', priceMinorUnits: TRY_(199), stockOnHand: 70, optionValue: 'Beyaz / M' },
      { sku: 'MB-KT-TS-BLK-M', priceMinorUnits: TRY_(199), stockOnHand: 60, optionValue: 'Siyah / M' },
      { sku: 'MB-KT-TS-BLK-L', priceMinorUnits: TRY_(199), stockOnHand: 40, optionValue: 'Siyah / L' },
    ],
    mediaSeed: 'k-basictshirt',
  },
  {
    slug: 'kadin-oversize-sweatshirt',
    title: 'Kadın Oversize Sweatshirt',
    description: 'Şardonlu, kapşonsuz, minimal baskı. Soğuk mevsim için rahat bir seçim.',
    brand: 'butik',
    categorySlugs: ['kadin-ustgiyim'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-KT-SW-GRY-M', priceMinorUnits: TRY_(399), stockOnHand: 35, optionValue: 'Gri / M' },
      { sku: 'MB-KT-SW-GRY-L', priceMinorUnits: TRY_(399), stockOnHand: 25, optionValue: 'Gri / L' },
      { sku: 'MB-KT-SW-BLU-M', priceMinorUnits: TRY_(399), stockOnHand: 18, optionValue: 'Mavi / M' },
    ],
    mediaSeed: 'k-sweatshirt',
  },
  {
    slug: 'kadin-gomlek-oxford',
    title: 'Kadın Oxford Gömlek',
    description: 'Klasik kesim, uzun kol; şık ofis kombinleri için vazgeçilmez parça.',
    brand: 'butik',
    categorySlugs: ['kadin-ustgiyim'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-KT-OX-WHT-M', priceMinorUnits: TRY_(499), stockOnHand: 20, optionValue: 'Beyaz / M' },
      { sku: 'MB-KT-OX-BLU-M', priceMinorUnits: TRY_(499), stockOnHand: 18, optionValue: 'Mavi / M' },
      { sku: 'MB-KT-OX-WHT-L', priceMinorUnits: TRY_(499), stockOnHand: 12, optionValue: 'Beyaz / L' },
    ],
    mediaSeed: 'k-oxford',
  },
  // Kadın alt giyim
  {
    slug: 'kadin-slim-jean',
    title: 'Kadın Slim Fit Jean Pantolon',
    description: 'Yüksek bel, hafif esnek likralı kumaş; rahat kalıp.',
    brand: 'butik',
    categorySlugs: ['kadin-altgiyim'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-KA-JN-BLU-36', priceMinorUnits: TRY_(599), stockOnHand: 30, optionValue: 'Mavi / 36' },
      { sku: 'MB-KA-JN-BLU-38', priceMinorUnits: TRY_(599), stockOnHand: 45, optionValue: 'Mavi / 38' },
      { sku: 'MB-KA-JN-BLK-38', priceMinorUnits: TRY_(599), stockOnHand: 28, optionValue: 'Siyah / 38' },
    ],
    mediaSeed: 'k-jean',
  },
  {
    slug: 'kadin-kumas-pantolon',
    title: 'Kadın Klasik Kumaş Pantolon',
    description: 'Yüksek bel, dökümlü kumaş; ofis ve davet için uygun.',
    brand: 'butik',
    categorySlugs: ['kadin-altgiyim'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-KA-KP-BLK-38', priceMinorUnits: TRY_(449), stockOnHand: 22, optionValue: 'Siyah / 38' },
      { sku: 'MB-KA-KP-BEJ-38', priceMinorUnits: TRY_(449), stockOnHand: 15, optionValue: 'Bej / 38' },
    ],
    mediaSeed: 'k-pantolon',
  },
  // Kadın elbise
  {
    slug: 'kadin-midi-elbise',
    title: 'Kadın Midi Boy Krep Elbise',
    description: 'Krep kumaş, V yaka, midi boy; düğün ve davet kombinleri için.',
    brand: 'butik',
    categorySlugs: ['kadin-elbise'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-KE-MD-BLK-M', priceMinorUnits: TRY_(799), stockOnHand: 18, optionValue: 'Siyah / M' },
      { sku: 'MB-KE-MD-RED-M', priceMinorUnits: TRY_(799), stockOnHand: 10, optionValue: 'Kırmızı / M' },
    ],
    mediaSeed: 'k-midi',
  },
  {
    slug: 'kadin-yazlik-salas',
    title: 'Kadın Salaş Yazlık Elbise',
    description: 'Viskon kumaş, ayarlanabilir askı; sıcak havalar için hafif.',
    brand: 'butik',
    categorySlugs: ['kadin-elbise'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-KE-SL-FLO-S', priceMinorUnits: TRY_(349), stockOnHand: 25, optionValue: 'Çiçekli / S' },
      { sku: 'MB-KE-SL-FLO-M', priceMinorUnits: TRY_(349), stockOnHand: 30, optionValue: 'Çiçekli / M' },
    ],
    mediaSeed: 'k-salas',
  },

  // Erkek üst giyim
  {
    slug: 'erkek-basic-tshirt',
    title: 'Erkek Basic Pamuklu Tişört',
    description: '%100 pamuk, bisiklet yaka, regular fit. Günlük kullanım için temel parça.',
    brand: 'butik',
    categorySlugs: ['erkek-ustgiyim'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-ET-TS-WHT-M', priceMinorUnits: TRY_(189), stockOnHand: 80, optionValue: 'Beyaz / M' },
      { sku: 'MB-ET-TS-WHT-L', priceMinorUnits: TRY_(189), stockOnHand: 65, optionValue: 'Beyaz / L' },
      { sku: 'MB-ET-TS-BLK-L', priceMinorUnits: TRY_(189), stockOnHand: 50, optionValue: 'Siyah / L' },
      { sku: 'MB-ET-TS-BLK-XL', priceMinorUnits: TRY_(189), stockOnHand: 40, optionValue: 'Siyah / XL' },
    ],
    mediaSeed: 'e-basictshirt',
  },
  {
    slug: 'erkek-polo-yaka',
    title: 'Erkek Pike Polo Yaka Tişört',
    description: 'Pike örgü, kısa kol, düğmeli polo yaka; ofis-casual kombin için.',
    brand: 'butik',
    categorySlugs: ['erkek-ustgiyim'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-ET-PL-NVY-L', priceMinorUnits: TRY_(299), stockOnHand: 40, optionValue: 'Lacivert / L' },
      { sku: 'MB-ET-PL-GRY-L', priceMinorUnits: TRY_(299), stockOnHand: 30, optionValue: 'Gri / L' },
      { sku: 'MB-ET-PL-NVY-XL', priceMinorUnits: TRY_(299), stockOnHand: 25, optionValue: 'Lacivert / XL' },
    ],
    mediaSeed: 'e-polo',
  },
  {
    slug: 'erkek-gomlek-oxford',
    title: 'Erkek Oxford Gömlek',
    description: 'Uzun kol, klasik kalıp, Oxford kumaş; ofis şıklığı için ideal.',
    brand: 'butik',
    categorySlugs: ['erkek-ustgiyim'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-ET-OX-WHT-L', priceMinorUnits: TRY_(499), stockOnHand: 20, optionValue: 'Beyaz / L' },
      { sku: 'MB-ET-OX-BLU-L', priceMinorUnits: TRY_(499), stockOnHand: 18, optionValue: 'Mavi / L' },
    ],
    mediaSeed: 'e-oxford',
  },
  // Erkek alt giyim
  {
    slug: 'erkek-chino-pantolon',
    title: 'Erkek Chino Pantolon',
    description: 'Slim fit, pamuk karışımlı; ofis ve haftasonu kombinleri için.',
    brand: 'butik',
    categorySlugs: ['erkek-altgiyim'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-EA-CH-BEJ-32', priceMinorUnits: TRY_(549), stockOnHand: 28, optionValue: 'Bej / 32' },
      { sku: 'MB-EA-CH-LAC-32', priceMinorUnits: TRY_(549), stockOnHand: 22, optionValue: 'Lacivert / 32' },
    ],
    mediaSeed: 'e-chino',
  },
  {
    slug: 'erkek-jean-pantolon',
    title: 'Erkek Regular Fit Jean Pantolon',
    description: 'Likralı denim, regular kesim; günlük rahat kullanım.',
    brand: 'butik',
    categorySlugs: ['erkek-altgiyim'],
    optionName: 'Renk / Beden',
    variants: [
      { sku: 'MB-EA-JN-BLU-32', priceMinorUnits: TRY_(599), stockOnHand: 35, optionValue: 'Mavi / 32' },
      { sku: 'MB-EA-JN-BLU-34', priceMinorUnits: TRY_(599), stockOnHand: 32, optionValue: 'Mavi / 34' },
      { sku: 'MB-EA-JN-BLK-34', priceMinorUnits: TRY_(599), stockOnHand: 20, optionValue: 'Siyah / 34' },
    ],
    mediaSeed: 'e-jean',
  },

  // Çocuk
  {
    slug: 'cocuk-tshirt-print',
    title: 'Çocuk Baskılı Tişört',
    description: 'Yumuşak pamuklu, eğlenceli baskılar; 3-10 yaş arası.',
    brand: 'butik',
    categorySlugs: ['cocuk-giyim'],
    optionName: 'Renk / Yaş',
    variants: [
      { sku: 'MB-CC-TS-SAR-4', priceMinorUnits: TRY_(129), stockOnHand: 45, optionValue: 'Sarı / 4 Yaş' },
      { sku: 'MB-CC-TS-YSL-6', priceMinorUnits: TRY_(129), stockOnHand: 38, optionValue: 'Yeşil / 6 Yaş' },
      { sku: 'MB-CC-TS-MVI-8', priceMinorUnits: TRY_(129), stockOnHand: 30, optionValue: 'Mavi / 8 Yaş' },
    ],
    mediaSeed: 'c-tshirt',
  },
  {
    slug: 'cocuk-esofman-alt',
    title: 'Çocuk Eşofman Altı',
    description: 'Lastikli bel, iki cep; rahat örme kumaş. 4-12 yaş.',
    brand: 'butik',
    categorySlugs: ['cocuk-giyim'],
    optionName: 'Renk / Yaş',
    variants: [
      { sku: 'MB-CC-EF-GRY-6', priceMinorUnits: TRY_(229), stockOnHand: 25, optionValue: 'Gri / 6 Yaş' },
      { sku: 'MB-CC-EF-NVY-8', priceMinorUnits: TRY_(229), stockOnHand: 22, optionValue: 'Lacivert / 8 Yaş' },
    ],
    mediaSeed: 'c-esofman',
  },
  {
    slug: 'cocuk-kapsonlu-sweatshirt',
    title: 'Çocuk Kapüşonlu Sweatshirt',
    description: 'Şardonlu, kapüşonlu; soğuk havalar için sıcak tutan örme.',
    brand: 'butik',
    categorySlugs: ['cocuk-giyim'],
    optionName: 'Renk / Yaş',
    variants: [
      { sku: 'MB-CC-SW-KRM-6', priceMinorUnits: TRY_(299), stockOnHand: 18, optionValue: 'Kırmızı / 6 Yaş' },
      { sku: 'MB-CC-SW-LAC-8', priceMinorUnits: TRY_(299), stockOnHand: 15, optionValue: 'Lacivert / 8 Yaş' },
    ],
    mediaSeed: 'c-sweat',
  },
];

const customers = [
  { email: 'selin.aksoy@example.com', firstName: 'Selin', lastName: 'Aksoy', phone: '+905302222201', city: 'İstanbul', line1: 'Etiler Nisbetiye Cd. 22', region: 'Beşiktaş', postalCode: '34337' },
  { email: 'kerem.bulut@example.com', firstName: 'Kerem', lastName: 'Bulut', phone: '+905302222202', city: 'Ankara', line1: 'Bahçelievler 7. Cd. 18', region: 'Çankaya', postalCode: '06490' },
  { email: 'deniz.korkmaz@example.com', firstName: 'Deniz', lastName: 'Korkmaz', phone: '+905302222203', city: 'İzmir', line1: 'Alsancak Atatürk Cd. 225', region: 'Konak', postalCode: '35220' },
  { email: 'merve.guler@example.com', firstName: 'Merve', lastName: 'Güler', phone: '+905302222204', city: 'İstanbul', line1: 'Ataşehir Ata 2/3 Blok D:14', region: 'Ataşehir', postalCode: '34758' },
  { email: 'emre.taskin@example.com', firstName: 'Emre', lastName: 'Taşkın', phone: '+905302222205', city: 'Ankara', line1: 'Ümitköy 8. Cd. 44', region: 'Yenimahalle', postalCode: '06810' },
];

type OrderSpec = {
  orderNumber: string;
  customerEmail: string;
  status:
    | 'pending_payment'
    | 'payment_success'
    | 'preparing'
    | 'shipped'
    | 'delivered'
    | 'closed'
    | 'cancelled'
    | 'refund_requested'
    | 'refunded';
  lines: Array<{ sku: string; quantity: number }>;
  shippingMinor?: bigint;
  discountMinor?: bigint;
  couponCode?: string;
  daysAgo: number;
};

const orders: OrderSpec[] = [
  { orderNumber: 'MB-20001', customerEmail: 'selin.aksoy@example.com',  status: 'pending_payment', lines: [{ sku: 'MB-KT-TS-WHT-M', quantity: 2 }, { sku: 'MB-KA-JN-BLU-38', quantity: 1 }], shippingMinor: 3_900n, daysAgo: 0 },
  { orderNumber: 'MB-20002', customerEmail: 'merve.guler@example.com',  status: 'payment_success', lines: [{ sku: 'MB-KE-MD-BLK-M', quantity: 1 }], shippingMinor: 3_900n, discountMinor: 15_980n, couponCode: 'PERCENT20', daysAgo: 2 },
  { orderNumber: 'MB-20003', customerEmail: 'kerem.bulut@example.com',  status: 'shipped', lines: [{ sku: 'MB-ET-PL-NVY-L', quantity: 2 }, { sku: 'MB-EA-CH-BEJ-32', quantity: 1 }], shippingMinor: 3_900n, daysAgo: 5 },
  { orderNumber: 'MB-20004', customerEmail: 'deniz.korkmaz@example.com', status: 'delivered', lines: [{ sku: 'MB-CC-SW-LAC-8', quantity: 1 }, { sku: 'MB-CC-EF-NVY-8', quantity: 1 }], shippingMinor: 3_900n, daysAgo: 14 },
  { orderNumber: 'MB-20005', customerEmail: 'emre.taskin@example.com',  status: 'cancelled', lines: [{ sku: 'MB-EA-JN-BLU-34', quantity: 1 }], shippingMinor: 3_900n, daysAgo: 3 },
];

const coupons = [
  {
    code: 'PERCENT20',
    type: 'PERCENT' as const,
    value: 2000, // 20% in basis points
    minimumAmount: 25_000n, // 250 TL
    maximumDiscount: 20_000n, // cap 200 TL
    isActive: true,
    endsAt: null,
  },
];

export const modaButikSpec: DemoTenantSpec = {
  subdomain: 'moda-butik',
  name: 'Moda Butik',
  planCode: 'starter',
  status: 'active',
  currency: 'TRY',
  ownerEmail: 'owner@moda-butik.local',
  ownerPassword: 'owner123',
  ownerFirstName: 'Moda',
  ownerLastName: 'Owner',
  staff: [],
  brands: [...brands],
  categories: [...categories],
  products,
  customers,
  orders,
  coupons,
};
