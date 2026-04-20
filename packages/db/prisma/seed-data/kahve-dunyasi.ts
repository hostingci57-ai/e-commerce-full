/**
 * Demo tenant #1 — "Kahve Dünyası" (Growth plan).
 *
 * 3 brands · 7 categories (tree) · 20 products with variants
 * 10 customers · 15 orders across all order statuses
 * 3 coupons (seeded only if Coupon model exists at runtime).
 */

import type { DemoTenantSpec } from './types';

/* -------------------------------------------------------------------------- */
/* Brands                                                                      */
/* -------------------------------------------------------------------------- */
const brands = [
  { slug: 'starbucks', name: 'Starbucks' },
  { slug: 'nespresso', name: 'Nespresso' },
  { slug: 'lavazza', name: 'Lavazza' },
] as const;

/* -------------------------------------------------------------------------- */
/* Categories (tree)                                                           */
/* -------------------------------------------------------------------------- */
const categories = [
  { slug: 'kahve', name: 'Kahve', parent: null, position: 0 },
  { slug: 'espresso', name: 'Espresso', parent: 'kahve', position: 0 },
  { slug: 'filtre-kahve', name: 'Filtre Kahve', parent: 'kahve', position: 1 },
  { slug: 'turk-kahvesi', name: 'Türk Kahvesi', parent: 'kahve', position: 2 },
  { slug: 'aksesuar', name: 'Aksesuar', parent: null, position: 1 },
  { slug: 'termos', name: 'Termos', parent: 'aksesuar', position: 0 },
  { slug: 'fincan', name: 'Fincan', parent: 'aksesuar', position: 1 },
  { slug: 'kapsul', name: 'Kapsül', parent: null, position: 2 },
] as const;

/* -------------------------------------------------------------------------- */
/* Products                                                                    */
/* TRY minor units = kuruş. 1 TL = 100 minor units.                            */
/* -------------------------------------------------------------------------- */
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

const products: ProductSpec[] = [
  // ---- Coffee (10) --------------------------------------------------------
  {
    slug: 'starbucks-pike-place-roast',
    title: 'Starbucks Pike Place Roast Çekirdek Kahve',
    description:
      'Latin Amerika çekirdeklerinin orta kavrumu; cevizli ve kakao tonlu, her gün için klasik bir filtre harmanı.',
    brand: 'starbucks',
    categorySlugs: ['filtre-kahve'],
    optionName: 'Ağırlık',
    variants: [
      { sku: 'KD-SB-PIKE-250', priceMinorUnits: 18_900n, stockOnHand: 120, optionValue: '250g' },
      { sku: 'KD-SB-PIKE-500', priceMinorUnits: 34_900n, stockOnHand: 80, optionValue: '500g' },
      { sku: 'KD-SB-PIKE-1000', priceMinorUnits: 64_900n, stockOnHand: 35, optionValue: '1kg' },
    ],
    mediaSeed: 'pike',
  },
  {
    slug: 'lavazza-super-crema',
    title: 'Lavazza Super Crema Espresso Çekirdek',
    description:
      'Tatlı ve kremsi; fındık ve bal tonlarıyla espresso için ideal. Arabica ve Robusta harmanı.',
    brand: 'lavazza',
    categorySlugs: ['espresso'],
    optionName: 'Ağırlık',
    variants: [
      { sku: 'KD-LV-SC-250', priceMinorUnits: 22_900n, stockOnHand: 95, optionValue: '250g' },
      { sku: 'KD-LV-SC-1000', priceMinorUnits: 79_900n, stockOnHand: 45, optionValue: '1kg' },
    ],
    mediaSeed: 'supercrema',
  },
  {
    slug: 'starbucks-espresso-roast',
    title: 'Starbucks Espresso Roast',
    description:
      'Koyu kavrulmuş, karamelize şeker tonları. Süt bazlı içeceklerde karakterini korur.',
    brand: 'starbucks',
    categorySlugs: ['espresso'],
    optionName: 'Ağırlık',
    variants: [
      { sku: 'KD-SB-ESP-250', priceMinorUnits: 19_900n, stockOnHand: 70, optionValue: '250g' },
      { sku: 'KD-SB-ESP-1000', priceMinorUnits: 72_900n, stockOnHand: 30, optionValue: '1kg' },
    ],
    mediaSeed: 'espresso-roast',
  },
  {
    slug: 'lavazza-qualita-oro',
    title: 'Lavazza Qualità Oro Öğütülmüş Kahve',
    description:
      '%100 Arabica, altın renkli ambalajında klasik İtalyan harmanı. Meyvemsi ve çiçeksi notalar.',
    brand: 'lavazza',
    categorySlugs: ['filtre-kahve'],
    optionName: 'Ağırlık',
    variants: [
      { sku: 'KD-LV-ORO-250', priceMinorUnits: 16_900n, stockOnHand: 140, optionValue: '250g' },
    ],
    mediaSeed: 'qualita-oro',
  },
  {
    slug: 'turk-kahvesi-klasik',
    title: 'Geleneksel Türk Kahvesi',
    description:
      'Anadolu tadı; ince öğütülmüş, köpüğü bol klasik Türk kahvesi. Günlük demleme için ideal.',
    brand: null,
    categorySlugs: ['turk-kahvesi'],
    optionName: 'Ağırlık',
    variants: [
      { sku: 'KD-TK-KLS-100', priceMinorUnits: 8_900n, stockOnHand: 200, optionValue: '100g' },
      { sku: 'KD-TK-KLS-250', priceMinorUnits: 19_900n, stockOnHand: 150, optionValue: '250g' },
      { sku: 'KD-TK-KLS-500', priceMinorUnits: 36_900n, stockOnHand: 70, optionValue: '500g' },
    ],
    mediaSeed: 'turk-klasik',
  },
  {
    slug: 'turk-kahvesi-menengic',
    title: 'Menengiç Katkılı Türk Kahvesi',
    description:
      'Güneydoğu lezzeti; menengiç meyvesi katkılı, süt ile servis için aromatik bir harman.',
    brand: null,
    categorySlugs: ['turk-kahvesi'],
    optionName: 'Ağırlık',
    variants: [
      { sku: 'KD-TK-MNG-200', priceMinorUnits: 14_900n, stockOnHand: 90, optionValue: '200g' },
    ],
    mediaSeed: 'menengic',
  },
  {
    slug: 'nespresso-ispirazione-roma',
    title: 'Nespresso Ispirazione Roma Kapsül (Bütün Kahve Alternatifi)',
    description:
      'Roma usulü; yoğun kremalı espresso. Bütün çekirdek severlere 200g öğütülmüş formda.',
    brand: 'nespresso',
    categorySlugs: ['filtre-kahve'],
    optionName: 'Ağırlık',
    variants: [
      { sku: 'KD-NP-RMA-200', priceMinorUnits: 17_900n, stockOnHand: 60, optionValue: '200g' },
    ],
    mediaSeed: 'roma-ground',
  },
  {
    slug: 'kolombiya-huila-filtre',
    title: 'Kolombiya Huila Tek Menşe Filtre',
    description:
      'Huila bölgesinden yıkanmış yöntemle işlenmiş; karamel, kırmızı elma ve kakao nüansları.',
    brand: null,
    categorySlugs: ['filtre-kahve'],
    optionName: 'Ağırlık',
    variants: [
      { sku: 'KD-KB-HUI-250', priceMinorUnits: 27_900n, stockOnHand: 40, optionValue: '250g' },
      { sku: 'KD-KB-HUI-500', priceMinorUnits: 51_900n, stockOnHand: 25, optionValue: '500g' },
    ],
    mediaSeed: 'huila',
  },
  {
    slug: 'etiyopya-yirgacheffe',
    title: 'Etiyopya Yirgacheffe Tek Menşe',
    description:
      'Çiçeksi aroma, bergamot ve yaban mersini tonları; V60 ve Chemex için mükemmel.',
    brand: null,
    categorySlugs: ['filtre-kahve'],
    optionName: 'Ağırlık',
    variants: [
      { sku: 'KD-ET-YRG-250', priceMinorUnits: 32_900n, stockOnHand: 55, optionValue: '250g' },
    ],
    mediaSeed: 'yirgacheffe',
  },
  {
    slug: 'espresso-blend-house',
    title: 'Ev Harmanı Espresso (House Blend)',
    description:
      'Brezilya + Kolombiya harmanı; dengeli, şekerli ve kakao tonlu günlük espresso kahvesi.',
    brand: null,
    categorySlugs: ['espresso'],
    optionName: 'Ağırlık',
    variants: [
      { sku: 'KD-HB-ESP-250', priceMinorUnits: 21_900n, stockOnHand: 110, optionValue: '250g' },
      { sku: 'KD-HB-ESP-1000', priceMinorUnits: 74_900n, stockOnHand: 50, optionValue: '1kg' },
    ],
    mediaSeed: 'house-blend',
  },

  // ---- Accessories (5) ----------------------------------------------------
  {
    slug: 'paslanmaz-termos-500',
    title: 'Paslanmaz Çelik Termos 500 ml',
    description:
      'Çift cidarlı, 12 saate kadar sıcak tutma. Sızdırmaz kapak, BPA içermez iç yüzey.',
    brand: null,
    categorySlugs: ['termos'],
    optionName: 'Renk',
    variants: [
      { sku: 'KD-TRM-500-BLK', priceMinorUnits: 39_900n, stockOnHand: 40, optionValue: 'Siyah' },
      { sku: 'KD-TRM-500-SLV', priceMinorUnits: 39_900n, stockOnHand: 25, optionValue: 'Gümüş' },
    ],
    mediaSeed: 'termos500',
  },
  {
    slug: 'paslanmaz-termos-750',
    title: 'Paslanmaz Çelik Termos 750 ml',
    description:
      'Günlük kullanım için geniş hacim. İç bölmesi mat işlemli, kokusuz, dış yüzey toz boya.',
    brand: null,
    categorySlugs: ['termos'],
    optionName: 'Renk',
    variants: [
      { sku: 'KD-TRM-750-BLK', priceMinorUnits: 54_900n, stockOnHand: 30, optionValue: 'Siyah' },
      { sku: 'KD-TRM-750-NVY', priceMinorUnits: 54_900n, stockOnHand: 18, optionValue: 'Lacivert' },
    ],
    mediaSeed: 'termos750',
  },
  {
    slug: 'porselen-espresso-fincani',
    title: 'Porselen Espresso Fincanı (2\'li Set)',
    description:
      'Kalın cidarlı porselen; 70 ml kapasite, ısıyı korur. Bulaşık makinesinde yıkanabilir.',
    brand: null,
    categorySlugs: ['fincan'],
    optionName: 'Renk',
    variants: [
      { sku: 'KD-FC-ESP-WHT', priceMinorUnits: 18_900n, stockOnHand: 60, optionValue: 'Beyaz' },
      { sku: 'KD-FC-ESP-BLK', priceMinorUnits: 18_900n, stockOnHand: 45, optionValue: 'Siyah' },
    ],
    mediaSeed: 'fincan-espresso',
  },
  {
    slug: 'cam-turk-kahve-fincani',
    title: 'Çift Cidarlı Cam Türk Kahve Fincanı',
    description:
      'Borosilikat cam, çift cidar; sıcak tutar, dışı ısıtmaz. 6\'lı set, nötr tasarım.',
    brand: null,
    categorySlugs: ['fincan'],
    variants: [{ sku: 'KD-FC-TK-CAM', priceMinorUnits: 29_900n, stockOnHand: 55 }],
    mediaSeed: 'fincan-cam',
  },
  {
    slug: 'seramik-kupa-320',
    title: 'Seramik Kahve Kupası 320 ml',
    description:
      'Modern tasarım, mat seramik; günlük filtre kahve için ideal hacim. Mikrodalga uyumlu.',
    brand: null,
    categorySlugs: ['fincan'],
    optionName: 'Renk',
    variants: [
      { sku: 'KD-KP-320-BEJ', priceMinorUnits: 12_900n, stockOnHand: 80, optionValue: 'Bej' },
      { sku: 'KD-KP-320-YSL', priceMinorUnits: 12_900n, stockOnHand: 40, optionValue: 'Yeşil' },
      { sku: 'KD-KP-320-MVI', priceMinorUnits: 12_900n, stockOnHand: 35, optionValue: 'Mavi' },
    ],
    mediaSeed: 'kupa320',
  },

  // ---- Capsules (5) -------------------------------------------------------
  {
    slug: 'nespresso-arpeggio-10li',
    title: 'Nespresso Arpeggio 10\'lu Kapsül',
    description:
      'Yoğunluk 9; Güney Amerika harmanı, kakao notalı klasik espresso kapsülü.',
    brand: 'nespresso',
    categorySlugs: ['kapsul'],
    optionName: 'Paket',
    variants: [
      { sku: 'KD-KP-ARP-10', priceMinorUnits: 12_900n, stockOnHand: 150, optionValue: '10 Adet' },
      { sku: 'KD-KP-ARP-50', priceMinorUnits: 58_900n, stockOnHand: 40, optionValue: '50 Adet' },
    ],
    mediaSeed: 'arpeggio',
  },
  {
    slug: 'nespresso-ristretto-10li',
    title: 'Nespresso Ristretto 10\'lu Kapsül',
    description:
      'Yoğunluk 10; kısa çekim için hazırlanmış; güçlü ve fındık aromalı.',
    brand: 'nespresso',
    categorySlugs: ['kapsul'],
    optionName: 'Paket',
    variants: [
      { sku: 'KD-KP-RST-10', priceMinorUnits: 13_900n, stockOnHand: 120, optionValue: '10 Adet' },
    ],
    mediaSeed: 'ristretto',
  },
  {
    slug: 'lavazza-modo-mio-crema',
    title: 'Lavazza Modo Mio Qualità Rossa Kapsül 16\'lı',
    description:
      'Kremalı, yuvarlak gövdeli; Lavazza Modo Mio sistemleri için 16\'lı paket.',
    brand: 'lavazza',
    categorySlugs: ['kapsul'],
    variants: [{ sku: 'KD-KP-LMM-16', priceMinorUnits: 17_900n, stockOnHand: 85 }],
    mediaSeed: 'modo-mio',
  },
  {
    slug: 'nespresso-vertuo-stormio',
    title: 'Nespresso Vertuo Stormio 10\'lu',
    description:
      'Vertuo sistemleri için; koyu kavrum, güçlü kakao tonları, 230 ml uzun kupa için.',
    brand: 'nespresso',
    categorySlugs: ['kapsul'],
    variants: [{ sku: 'KD-KP-VRT-STR', priceMinorUnits: 21_900n, stockOnHand: 60 }],
    mediaSeed: 'stormio',
  },
  {
    slug: 'dekafein-kapsul-mix',
    title: 'Kafeinsiz Karışık Kapsül 20\'li',
    description:
      'Farklı yoğunluk seviyelerinde kafeinsiz seçenekler; akşam içimi için kür paketi.',
    brand: null,
    categorySlugs: ['kapsul'],
    variants: [{ sku: 'KD-KP-DCF-20', priceMinorUnits: 26_900n, stockOnHand: 45 }],
    mediaSeed: 'decaf-mix',
  },
];

/* -------------------------------------------------------------------------- */
/* Customers (10)                                                              */
/* -------------------------------------------------------------------------- */
const customers = [
  { email: 'ayse.yilmaz@example.com', firstName: 'Ayşe', lastName: 'Yılmaz', phone: '+905301111101', city: 'İstanbul', line1: 'Bağdat Caddesi No:45 D:3', region: 'Kadıköy', postalCode: '34710' },
  { email: 'mehmet.demir@example.com', firstName: 'Mehmet', lastName: 'Demir', phone: '+905301111102', city: 'Ankara', line1: 'Tunalı Hilmi Cd. No:72', region: 'Çankaya', postalCode: '06680' },
  { email: 'elif.kaya@example.com', firstName: 'Elif', lastName: 'Kaya', phone: '+905301111103', city: 'İzmir', line1: 'Alsancak, Kıbrıs Şehitleri Cd. 18', region: 'Konak', postalCode: '35220' },
  { email: 'ahmet.sahin@example.com', firstName: 'Ahmet', lastName: 'Şahin', phone: '+905301111104', city: 'İstanbul', line1: 'Barbaros Bulvarı 101', region: 'Beşiktaş', postalCode: '34349' },
  { email: 'zeynep.celik@example.com', firstName: 'Zeynep', lastName: 'Çelik', phone: '+905301111105', city: 'Ankara', line1: 'Bilkent 1. Cadde No:12', region: 'Çankaya', postalCode: '06800' },
  { email: 'mustafa.arslan@example.com', firstName: 'Mustafa', lastName: 'Arslan', phone: '+905301111106', city: 'İzmir', line1: 'Bostanlı Sahil Cd. 44', region: 'Karşıyaka', postalCode: '35590' },
  { email: 'fatma.ozturk@example.com', firstName: 'Fatma', lastName: 'Öztürk', phone: '+905301111107', city: 'İstanbul', line1: 'Nişantaşı Abdi İpekçi Cd. 7', region: 'Şişli', postalCode: '34367' },
  { email: 'hasan.aydin@example.com', firstName: 'Hasan', lastName: 'Aydın', phone: '+905301111108', city: 'Ankara', line1: 'Kızılay Atatürk Bulvarı 155', region: 'Çankaya', postalCode: '06420' },
  { email: 'seda.polat@example.com', firstName: 'Seda', lastName: 'Polat', phone: '+905301111109', city: 'İzmir', line1: 'Alsancak 1453 Sokak 11', region: 'Konak', postalCode: '35220' },
  { email: 'burak.yildiz@example.com', firstName: 'Burak', lastName: 'Yıldız', phone: '+905301111110', city: 'İstanbul', line1: 'Acıbadem Mah. Akasya Sok. 8', region: 'Üsküdar', postalCode: '34660' },
];

/* -------------------------------------------------------------------------- */
/* Orders (15) — line items reference product slugs + variant SKUs             */
/* -------------------------------------------------------------------------- */
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
  // 3 pending_payment
  { orderNumber: 'KD-10001', customerEmail: 'ayse.yilmaz@example.com',  status: 'pending_payment', lines: [{ sku: 'KD-SB-PIKE-500', quantity: 1 }, { sku: 'KD-KP-ARP-10', quantity: 2 }], shippingMinor: 4_900n, daysAgo: 0 },
  { orderNumber: 'KD-10002', customerEmail: 'mehmet.demir@example.com', status: 'pending_payment', lines: [{ sku: 'KD-TK-KLS-250', quantity: 2 }], shippingMinor: 4_900n, daysAgo: 0 },
  { orderNumber: 'KD-10003', customerEmail: 'burak.yildiz@example.com', status: 'pending_payment', lines: [{ sku: 'KD-LV-SC-1000', quantity: 1 }, { sku: 'KD-FC-ESP-BLK', quantity: 1 }], shippingMinor: 4_900n, daysAgo: 1 },

  // 5 paid (payment_success or preparing)
  { orderNumber: 'KD-10004', customerEmail: 'elif.kaya@example.com',  status: 'payment_success', lines: [{ sku: 'KD-ET-YRG-250', quantity: 2 }], shippingMinor: 4_900n, daysAgo: 2 },
  { orderNumber: 'KD-10005', customerEmail: 'ahmet.sahin@example.com', status: 'payment_success', lines: [{ sku: 'KD-KP-ARP-50', quantity: 1 }, { sku: 'KD-KP-LMM-16', quantity: 2 }], shippingMinor: 0n, couponCode: 'KARGO', daysAgo: 2 },
  { orderNumber: 'KD-10006', customerEmail: 'zeynep.celik@example.com', status: 'preparing', lines: [{ sku: 'KD-TRM-500-BLK', quantity: 1 }, { sku: 'KD-HB-ESP-250', quantity: 1 }], shippingMinor: 4_900n, daysAgo: 3 },
  { orderNumber: 'KD-10007', customerEmail: 'mustafa.arslan@example.com', status: 'preparing', lines: [{ sku: 'KD-SB-ESP-1000', quantity: 1 }], shippingMinor: 4_900n, discountMinor: 7_290n, couponCode: 'WELCOME10', daysAgo: 3 },
  { orderNumber: 'KD-10008', customerEmail: 'fatma.ozturk@example.com',  status: 'payment_success', lines: [{ sku: 'KD-KP-320-BEJ', quantity: 2 }, { sku: 'KD-FC-TK-CAM', quantity: 1 }], shippingMinor: 4_900n, daysAgo: 4 },

  // 3 shipped
  { orderNumber: 'KD-10009', customerEmail: 'hasan.aydin@example.com', status: 'shipped', lines: [{ sku: 'KD-LV-ORO-250', quantity: 3 }], shippingMinor: 4_900n, daysAgo: 5 },
  { orderNumber: 'KD-10010', customerEmail: 'seda.polat@example.com',  status: 'shipped', lines: [{ sku: 'KD-TRM-750-NVY', quantity: 1 }, { sku: 'KD-KP-VRT-STR', quantity: 2 }], shippingMinor: 4_900n, daysAgo: 6 },
  { orderNumber: 'KD-10011', customerEmail: 'burak.yildiz@example.com', status: 'shipped', lines: [{ sku: 'KD-NP-RMA-200', quantity: 2 }, { sku: 'KD-TK-MNG-200', quantity: 1 }], shippingMinor: 4_900n, daysAgo: 7 },

  // 2 delivered
  { orderNumber: 'KD-10012', customerEmail: 'ayse.yilmaz@example.com', status: 'delivered', lines: [{ sku: 'KD-KB-HUI-500', quantity: 1 }, { sku: 'KD-FC-ESP-WHT', quantity: 1 }], shippingMinor: 4_900n, daysAgo: 12 },
  { orderNumber: 'KD-10013', customerEmail: 'elif.kaya@example.com', status: 'delivered', lines: [{ sku: 'KD-TK-KLS-500', quantity: 1 }, { sku: 'KD-KP-RST-10', quantity: 1 }], shippingMinor: 4_900n, daysAgo: 18 },

  // 1 cancelled
  { orderNumber: 'KD-10014', customerEmail: 'mehmet.demir@example.com', status: 'cancelled', lines: [{ sku: 'KD-KP-DCF-20', quantity: 1 }], shippingMinor: 4_900n, daysAgo: 4 },

  // 1 refund_requested
  { orderNumber: 'KD-10015', customerEmail: 'zeynep.celik@example.com', status: 'refund_requested', lines: [{ sku: 'KD-TRM-500-SLV', quantity: 1 }], shippingMinor: 4_900n, daysAgo: 9 },
];

/* -------------------------------------------------------------------------- */
/* Coupons                                                                     */
/* -------------------------------------------------------------------------- */
const coupons = [
  {
    code: 'WELCOME10',
    type: 'PERCENT' as const,
    value: 1000, // basis points (10%)
    minimumAmount: 10_000n, // 100 TL
    maximumDiscount: null,
    isActive: true,
    endsAt: null,
  },
  {
    code: 'KARGO',
    type: 'FREE_SHIPPING' as const,
    value: 0,
    minimumAmount: null,
    maximumDiscount: null,
    isActive: true,
    endsAt: null,
  },
  {
    code: 'BAYRAM50',
    type: 'FIXED' as const,
    value: 5_000, // 50 TL in minor units
    minimumAmount: 20_000n, // 200 TL
    maximumDiscount: null,
    isActive: true,
    // expired yesterday relative to seed run
    endsAt: 'yesterday' as const,
  },
];

export const kahveDunyasiSpec: DemoTenantSpec = {
  subdomain: 'kahve-dunyasi',
  name: 'Kahve Dünyası',
  planCode: 'growth',
  status: 'active',
  currency: 'TRY',
  ownerEmail: 'owner@kahve-dunyasi.local',
  ownerPassword: 'owner123',
  ownerFirstName: 'Kahve',
  ownerLastName: 'Owner',
  staff: [
    {
      email: 'ops@kahve-dunyasi.local',
      password: 'ops123',
      firstName: 'Kahve',
      lastName: 'Operator',
      roleCode: 'ORDER_OPERATOR',
    },
    {
      email: 'product@kahve-dunyasi.local',
      password: 'product123',
      firstName: 'Kahve',
      lastName: 'Product',
      roleCode: 'PRODUCT_MANAGER',
    },
  ],
  brands: [...brands],
  categories: [...categories],
  products,
  customers,
  orders,
  coupons,
};
