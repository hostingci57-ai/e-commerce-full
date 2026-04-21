'use client';

import { api } from './api';

// Product list/detail/create shapes – loose typing, backend source of truth.
export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'active' | 'archived';
  basePrice?: string | number;
  brand?: { id: string; name: string } | null;
  categories?: { id: string; name: string }[];
  createdAt?: string;
  updatedAt?: string;
  stock?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
  nextCursor?: string | null;
}

export function listProducts(params: {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}): Promise<PaginatedResponse<ProductListItem>> {
  return api.get<PaginatedResponse<ProductListItem>>('/products', params);
}

export function getProduct(id: string) {
  return api.get<ProductListItem & Record<string, unknown>>(`/products/${id}`);
}

export function createProduct(body: unknown) {
  return api.post<ProductListItem>('/products', body);
}

export function updateProduct(id: string, body: unknown) {
  return api.patch<ProductListItem>(`/products/${id}`, body);
}

export function deleteProduct(id: string) {
  return api.delete<{ ok: true }>(`/products/${id}`);
}

export function upsertVariants(id: string, body: unknown) {
  return api.post<unknown>(`/products/${id}/variants`, body);
}

export interface BrandListItem {
  id: string;
  name: string;
  slug: string;
}
export function listBrands() {
  return api.get<BrandListItem[] | PaginatedResponse<BrandListItem>>('/brands');
}
export function createBrand(body: { name: string; slug: string }) {
  return api.post<BrandListItem>('/brands', body);
}
export function updateBrand(id: string, body: Partial<BrandListItem>) {
  return api.patch<BrandListItem>(`/brands/${id}`, body);
}
export function deleteBrand(id: string) {
  return api.delete<{ ok: true }>(`/brands/${id}`);
}

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children?: CategoryListItem[];
}
export function listCategories() {
  return api.get<CategoryListItem[]>('/categories');
}
export function getCategoryTree() {
  return api.get<CategoryListItem[]>('/categories/tree');
}
export function createCategory(body: {
  name: string;
  slug: string;
  parentId?: string | null;
}) {
  return api.post<CategoryListItem>('/categories', body);
}
export function updateCategory(id: string, body: Partial<CategoryListItem>) {
  return api.patch<CategoryListItem>(`/categories/${id}`, body);
}
export function deleteCategory(id: string) {
  return api.delete<{ ok: true }>(`/categories/${id}`);
}

export interface OrderListItem {
  id: string;
  orderNumber?: string;
  status: string;
  totalAmount?: string | number;
  currency?: string;
  customer?: { id: string; name?: string; email?: string } | null;
  createdAt?: string;
}
export function listOrders(params: {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}) {
  return api.get<PaginatedResponse<OrderListItem>>('/orders', params);
}
export function getOrder(id: string) {
  return api.get<OrderListItem & Record<string, unknown>>(`/orders/${id}`);
}
export function updateOrderStatus(id: string, body: { status: string; note?: string }) {
  return api.patch<OrderListItem>(`/orders/${id}/status`, body);
}
export function cancelOrder(id: string, body: { reason?: string }) {
  return api.post<OrderListItem>(`/orders/${id}/cancel`, body);
}

export interface CustomerListItem {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  createdAt?: string;
}
export function listCustomers(params: {
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  return api.get<PaginatedResponse<CustomerListItem>>('/customers', params);
}
export function getCustomer(id: string) {
  return api.get<CustomerListItem & Record<string, unknown>>(`/customers/${id}`);
}

// ----- Coupons --------------------------------------------------------------

export type CouponType = 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';

export interface CouponListItem {
  id: string;
  code: string;
  type: CouponType;
  value: string | number;
  minimumAmount?: string | number | null;
  maximumDiscount?: string | number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  usageCount: number;
  stackable: boolean;
  isActive: boolean;
  customerGroupIds?: string[];
  categoryIds?: string[];
  productIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CursorResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function listCoupons(params: {
  isActive?: boolean;
  query?: string;
  limit?: number;
  cursor?: string;
}) {
  return api.get<CursorResponse<CouponListItem>>('/coupons', params);
}
export function getCoupon(id: string) {
  return api.get<CouponListItem>(`/coupons/${id}`);
}
export function createCoupon(body: Partial<CouponListItem> & { code: string; type: CouponType; value: string | number }) {
  return api.post<CouponListItem>('/coupons', body);
}
export function updateCoupon(id: string, body: Partial<CouponListItem>) {
  return api.patch<CouponListItem>(`/coupons/${id}`, body);
}
export function deleteCoupon(id: string) {
  return api.delete<{ ok: true }>(`/coupons/${id}`);
}

// ----- Refund requests ------------------------------------------------------

export type RefundRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';

export interface RefundRequestItem {
  id: string;
  orderId: string;
  customerId?: string | null;
  reason: string;
  reasonCategory: string;
  requestedAmount: string | number;
  status: RefundRequestStatus;
  rejectionReason?: string | null;
  createdAt?: string;
  approvedAt?: string | null;
}

export function listRefundRequests(params: {
  status?: RefundRequestStatus;
  orderId?: string;
  limit?: number;
  cursor?: string;
}) {
  return api.get<CursorResponse<RefundRequestItem>>('/refund-requests', params);
}
export function getRefundRequest(id: string) {
  return api.get<RefundRequestItem & { refunds: unknown[] }>(`/refund-requests/${id}`);
}
export function approveRefundRequest(
  id: string,
  body: { note?: string; approvedAmount?: string | number; partial?: boolean },
) {
  return api.post<RefundRequestItem>(`/refund-requests/${id}/approve`, body);
}
export function rejectRefundRequest(id: string, body: { rejectionReason: string }) {
  return api.post<RefundRequestItem>(`/refund-requests/${id}/reject`, body);
}

// ----- Draft orders ---------------------------------------------------------

export interface DraftOrderLineInput {
  variantId: string;
  quantity: number;
  priceMinorUnits?: string | number;
}

export interface DraftOrderListItem {
  id: string;
  orderNumber?: string;
  status: string;
  currency?: string;
  totalMinor?: string | number;
  customerId?: string | null;
  guestEmail?: string | null;
  createdAt?: string;
}

export function listDraftOrders(params: {
  query?: string;
  customerId?: string;
  limit?: number;
  cursor?: string;
}) {
  return api.get<CursorResponse<DraftOrderListItem>>('/orders/draft', params);
}
export function getDraftOrder(id: string) {
  return api.get<DraftOrderListItem & Record<string, unknown>>(`/orders/draft/${id}`);
}
export function createDraftOrder(body: {
  customerId?: string | null;
  guestEmail?: string | null;
  currency: string;
  shippingMinor?: string | number;
  taxMinor?: string | number;
  discountMinor?: string | number;
  note?: string;
  lines: DraftOrderLineInput[];
}) {
  return api.post<DraftOrderListItem>('/orders/draft', body);
}
export function updateDraftOrder(
  id: string,
  body: Partial<{
    customerId: string | null;
    guestEmail: string | null;
    shippingMinor: string | number;
    taxMinor: string | number;
    discountMinor: string | number;
    note: string;
    lines: DraftOrderLineInput[];
  }>,
) {
  return api.patch<DraftOrderListItem>(`/orders/draft/${id}`, body);
}
export function convertDraftOrder(id: string, body: { notifyCustomer?: boolean } = {}) {
  return api.post<DraftOrderListItem>(`/orders/draft/${id}/convert`, body);
}

// ----- Webhooks -------------------------------------------------------------

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  failureCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  attempt: number;
  statusCode?: number | null;
  responseBody?: string | null;
  deliveredAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export function listWebhookSubscriptions() {
  return api.get<WebhookSubscription[]>('/webhooks/subscriptions');
}
export function getWebhookSubscription(id: string) {
  return api.get<WebhookSubscription>(`/webhooks/subscriptions/${id}`);
}
export function createWebhookSubscription(body: {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  isActive?: boolean;
}) {
  return api.post<WebhookSubscription>('/webhooks/subscriptions', body);
}
export function updateWebhookSubscription(
  id: string,
  body: Partial<{
    name: string;
    url: string;
    events: string[];
    secret: string;
    isActive: boolean;
  }>,
) {
  return api.patch<WebhookSubscription>(`/webhooks/subscriptions/${id}`, body);
}
export function deleteWebhookSubscription(id: string) {
  return api.delete<{ ok: true }>(`/webhooks/subscriptions/${id}`);
}
export function listWebhookDeliveries(
  id: string,
  params: { status?: 'success' | 'failed' | 'pending'; limit?: number; cursor?: string } = {},
) {
  return api.get<CursorResponse<WebhookDelivery>>(
    `/webhooks/subscriptions/${id}/deliveries`,
    params,
  );
}
export function retryWebhookDelivery(subId: string, deliveryId: string) {
  return api.post<{ ok: true }>(
    `/webhooks/subscriptions/${subId}/retry/${deliveryId}`,
  );
}

// ----- Media Library --------------------------------------------------------

export type MediaKind = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export interface MediaAsset {
  id: string;
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: string | number;
  width?: number | null;
  height?: number | null;
  kind: MediaKind;
  tags: string[];
  uploadedBy?: string | null;
  createdAt: string;
}

export function requestPresignedUpload(body: {
  filename: string;
  contentType: string;
  sizeBytes: number;
}) {
  return api.post<{ key: string; uploadUrl: string; expiresAt: string }>(
    '/media/presigned-url',
    body,
  );
}
export function createMediaAsset(body: {
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  tags?: string[];
}) {
  return api.post<MediaAsset>('/media/assets', body);
}
export function listMediaAssets(params: {
  kind?: MediaKind;
  tag?: string;
  limit?: number;
  cursor?: string;
} = {}) {
  return api.get<CursorResponse<MediaAsset>>('/media/assets', params);
}
export function getMediaSignedUrl(id: string) {
  return api.get<{ id: string; url: string; expiresAt: string }>(
    `/media/assets/${id}/signed-url`,
  );
}
export function deleteMediaAsset(id: string) {
  return api.delete<{ ok: true }>(`/media/assets/${id}`);
}

// ----- CMS Pages ------------------------------------------------------------

export interface CmsPageItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  showInFooter: boolean;
  showInHeader: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export function listCmsPages(params: {
  isPublished?: boolean;
  location?: 'header' | 'footer';
  limit?: number;
}) {
  return api.get<CmsPageItem[]>('/cms/pages', params);
}
export function getCmsPage(id: string) {
  return api.get<CmsPageItem>(`/cms/pages/${id}`);
}
export function createCmsPage(body: Partial<CmsPageItem> & { slug: string; title: string; content: string }) {
  return api.post<CmsPageItem>('/cms/pages', body);
}
export function updateCmsPage(id: string, body: Partial<CmsPageItem>) {
  return api.patch<CmsPageItem>(`/cms/pages/${id}`, body);
}
export function deleteCmsPage(id: string) {
  return api.delete<{ id: string; deleted: true }>(`/cms/pages/${id}`);
}
export function publishCmsPage(id: string) {
  return api.post<CmsPageItem>(`/cms/pages/${id}/publish`);
}
export function unpublishCmsPage(id: string) {
  return api.post<CmsPageItem>(`/cms/pages/${id}/unpublish`);
}

// ----- CMS Menus ------------------------------------------------------------

export interface CmsMenuItem {
  label: string;
  type: 'page' | 'category' | 'url';
  target: string;
  sortOrder?: number;
  children?: CmsMenuItem[];
}
export interface CmsMenu {
  id: string;
  key: string;
  name: string;
  items: CmsMenuItem[];
  isActive: boolean;
}
export function listCmsMenus() {
  return api.get<CmsMenu[]>('/cms/menus');
}
export function getCmsMenu(key: string) {
  return api.get<CmsMenu>(`/cms/menus/${key}`);
}
export function updateCmsMenu(key: string, body: { name?: string; items: CmsMenuItem[]; isActive?: boolean }) {
  return api.patch<CmsMenu>(`/cms/menus/${key}`, body);
}

// ----- SEO: Redirects -------------------------------------------------------

export interface RedirectItem {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: 301 | 302 | 307 | 308;
  isActive: boolean;
  createdAt?: string;
}
export function listRedirects(params: { isActive?: boolean; query?: string; limit?: number }) {
  return api.get<RedirectItem[]>('/seo/redirects', params);
}
export function createRedirect(body: {
  fromPath: string;
  toPath: string;
  statusCode?: number;
  isActive?: boolean;
}) {
  return api.post<RedirectItem>('/seo/redirects', body);
}
export function updateRedirect(id: string, body: Partial<RedirectItem>) {
  return api.patch<RedirectItem>(`/seo/redirects/${id}`, body);
}
export function deleteRedirect(id: string) {
  return api.delete<{ id: string; deleted: true }>(`/seo/redirects/${id}`);
}
export function importRedirects(csv: string, overwrite = false) {
  return api.post<{ created: number; updated: number; errors: string[] }>(
    '/seo/redirects/import',
    { csv, overwrite },
  );
}

// ----- SEO: Settings --------------------------------------------------------

export interface SeoSettings {
  defaultTitle?: string | null;
  titleTemplate?: string | null;
  defaultDescription?: string | null;
  defaultOgImage?: string | null;
  robotsTxt?: string | null;
  googleSiteVerification?: string | null;
  bingSiteVerification?: string | null;
}
export function getSeoSettings() {
  return api.get<SeoSettings>('/seo/settings');
}
export function updateSeoSettings(body: SeoSettings) {
  return api.patch<SeoSettings>('/seo/settings', body);
}

// ----- i18n -----------------------------------------------------------------

export interface LanguageItem {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
  isActive: boolean;
}
export interface TenantLanguageItem {
  languageCode: string;
  isDefault: boolean;
  isPublished: boolean;
}
export interface UiBundleItem {
  languageCode: string;
  namespace: string;
  strings: Record<string, string>;
  version: number;
  updatedAt?: string;
}

export function listLanguages() {
  return api.get<LanguageItem[]>('/i18n/languages');
}
export function listTenantLanguages() {
  return api.get<TenantLanguageItem[]>('/i18n/tenant-languages');
}
export function upsertTenantLanguage(body: {
  languageCode: string;
  isDefault?: boolean;
  isPublished?: boolean;
}) {
  return api.post<TenantLanguageItem>('/i18n/tenant-languages', body);
}
export function deleteTenantLanguage(code: string) {
  return api.delete<{ deleted: true }>(`/i18n/tenant-languages/${code}`);
}
export function listBundles(params: { languageCode?: string; namespace?: string }) {
  return api.get<UiBundleItem[]>('/i18n/bundles', params);
}
export function updateBundle(body: {
  languageCode: string;
  namespace: string;
  strings: Record<string, string>;
}) {
  return api.patch<UiBundleItem>('/i18n/bundles', body);
}

// ----- Payment / Shipping providers + Tenant settings (Faz 7c) -------------

export interface PaymentMethodConfig {
  id: string;
  providerCode: string;
  displayName: string;
  description: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  minAmount: string | null;
  maxAmount: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProviderCatalogueEntry {
  code: string;
  displayName: string;
  isActive: boolean;
}

export function listPaymentProviders() {
  return api.get<ProviderCatalogueEntry[]>('/tenant/payment-methods/providers');
}
export function listPaymentMethodConfigs() {
  return api.get<PaymentMethodConfig[]>('/tenant/payment-methods');
}
export function upsertPaymentMethodConfig(body: {
  providerCode: string;
  displayName: string;
  description?: string | null;
  config?: Record<string, unknown>;
  isActive?: boolean;
  sortOrder?: number;
  minAmount?: string | number | null;
  maxAmount?: string | number | null;
}) {
  return api.post<PaymentMethodConfig>('/tenant/payment-methods', body);
}
export function updatePaymentMethodConfig(
  id: string,
  body: Partial<Omit<PaymentMethodConfig, 'id' | 'providerCode'>>,
) {
  return api.patch<PaymentMethodConfig>(`/tenant/payment-methods/${id}`, body);
}
export function deletePaymentMethodConfig(id: string) {
  return api.delete<{ ok: true }>(`/tenant/payment-methods/${id}`);
}

export interface ShippingMethodConfig {
  id: string;
  providerCode: string;
  code: string;
  displayName: string;
  description: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  freeShippingThreshold: string | null;
}

export function listShippingProviders() {
  return api.get<ProviderCatalogueEntry[]>('/tenant/shipping-methods/providers');
}
export function listShippingMethodConfigs() {
  return api.get<ShippingMethodConfig[]>('/tenant/shipping-methods');
}
export function upsertShippingMethodConfig(body: {
  providerCode: string;
  code: string;
  displayName: string;
  description?: string | null;
  config?: Record<string, unknown>;
  isActive?: boolean;
  sortOrder?: number;
  estimatedDaysMin?: number | null;
  estimatedDaysMax?: number | null;
  freeShippingThreshold?: string | number | null;
}) {
  return api.post<ShippingMethodConfig>('/tenant/shipping-methods', body);
}
export function updateShippingMethodConfig(
  id: string,
  body: Partial<Omit<ShippingMethodConfig, 'id' | 'providerCode' | 'code'>>,
) {
  return api.patch<ShippingMethodConfig>(`/tenant/shipping-methods/${id}`, body);
}
export function deleteShippingMethodConfig(id: string) {
  return api.delete<{ ok: true }>(`/tenant/shipping-methods/${id}`);
}

export interface TenantSettings {
  tenantId: string;
  storeName: string;
  storeEmail: string;
  storePhone: string | null;
  storeAddress: Record<string, unknown> | null;
  currency: string;
  defaultLanguage: string;
  timezone: string;
  weightUnit: string;
  dimensionUnit: string;
  kvkkContact: string | null;
  taxNumber: string | null;
  legalName: string | null;
  logoMediaId: string | null;
  faviconMediaId: string | null;
  primaryColor: string | null;
  updatedAt?: string;
}

export function getTenantSettings() {
  return api.get<TenantSettings>('/tenant/settings');
}
export function updateTenantSettings(body: Partial<TenantSettings>) {
  return api.patch<TenantSettings>('/tenant/settings', body);
}

export function capturePayment(orderId: string) {
  return api.post<{ payment: { id: string; status: string } }>(
    `/orders/${orderId}/payment/capture`,
  );
}

export function createOrderShipment(
  orderId: string,
  body: {
    providerCode: string;
    trackingNumber?: string;
    trackingUrl?: string;
    note?: string;
  },
) {
  return api.post(`/orders/${orderId}/shipments`, body);
}

// ----- Analytics (Faz 8a) ---------------------------------------------------

export interface AnalyticsRange {
  from?: string;
  to?: string;
}

export interface KpiResponse {
  revenueMinor: string;
  orderCount: number;
  newCustomerCount: number;
  conversionRate: number;
  averageOrderValueMinor: string;
  sessionCount: number;
  from: string;
  to: string;
}

export interface RevenuePoint {
  period: string;
  revenueMinor: string;
  orderCount: number;
}

export interface TopProductRow {
  productId: string;
  title: string;
  totalQuantity: number;
  totalRevenueMinor: string;
}

export interface TopCustomerRow {
  customerId: string;
  email: string;
  name: string;
  orderCount: number;
  totalSpentMinor: string;
}

export interface CategoryBreakdownRow {
  categoryId: string;
  name: string;
  totalRevenueMinor: string;
  orderCount: number;
}

export interface StatusHistogramRow {
  status: string;
  count: number;
}

export interface AlertsResponse {
  lowStockCount: number;
  pendingRefundCount: number;
  abandonedCartCount: number;
  bankTransferPendingCount: number;
}

type QueryParams = Record<string, string | number | boolean | undefined | null>;

function toQuery(input: Record<string, unknown>): QueryParams {
  const out: QueryParams = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

export function fetchKpis(range: AnalyticsRange) {
  return api.get<KpiResponse>('/analytics/kpis', toQuery({ ...range }));
}
export function fetchRevenueSeries(
  range: AnalyticsRange & { granularity?: 'day' | 'week' | 'month' },
) {
  return api.get<RevenuePoint[]>(
    '/analytics/revenue-series',
    toQuery({ ...range }),
  );
}
export function fetchTopProducts(range: AnalyticsRange & { limit?: number }) {
  return api.get<TopProductRow[]>(
    '/analytics/top-products',
    toQuery({ ...range }),
  );
}
export function fetchTopCustomers(range: AnalyticsRange & { limit?: number }) {
  return api.get<TopCustomerRow[]>(
    '/analytics/top-customers',
    toQuery({ ...range }),
  );
}
export function fetchSalesByCategory(range: AnalyticsRange) {
  return api.get<CategoryBreakdownRow[]>(
    '/analytics/sales-by-category',
    toQuery({ ...range }),
  );
}
export function fetchOrdersByStatus(range: AnalyticsRange) {
  return api.get<StatusHistogramRow[]>(
    '/analytics/orders-by-status',
    toQuery({ ...range }),
  );
}
export function fetchAlerts() {
  return api.get<AlertsResponse>('/analytics/alerts');
}

// ---------------------------------------------------------------------------
// Reviews — moderation (Faz 8b)
// ---------------------------------------------------------------------------

export type ReviewStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SPAM';

export interface AdminReview {
  id: string;
  productId: string;
  productTitle: string | null;
  productSlug: string | null;
  customerId: string;
  customerEmail: string | null;
  customerName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: ReviewStatusValue;
  isVerifiedBuyer: boolean;
  helpfulCount: number;
  createdAt: string;
}

export interface AdminReviewList {
  items: AdminReview[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function listAdminReviews(params: {
  status?: ReviewStatusValue;
  productId?: string;
  rating?: number;
  page?: number;
  pageSize?: number;
}) {
  return api.get<AdminReviewList>('/reviews', params);
}

export function getAdminReview(id: string) {
  return api.get<
    AdminReview & {
      product: { id: string; title: string; slug: string } | null;
      customer: { id: string; email: string; name: string } | null;
    }
  >(`/reviews/${id}`);
}

export function approveReview(id: string) {
  return api.patch<AdminReview>(`/reviews/${id}/approve`);
}

export function rejectReview(id: string, reason?: string) {
  return api.patch<AdminReview>(`/reviews/${id}/reject`, { reason });
}

export function deleteReview(id: string) {
  return api.delete<{ id: string; deleted: true }>(`/reviews/${id}`);
}

// ---------------------------------------------------------------------------
// Abandoned carts (Faz 8b)
// ---------------------------------------------------------------------------

export interface AbandonedCartRow {
  id: string;
  cartToken: string;
  customerId: string | null;
  customerEmail: string | null;
  itemsSnapshot: Array<{
    variantId: string;
    productId: string;
    sku: string;
    title: string;
    qty: number;
    priceMinor: string;
  }>;
  totalAmount: string;
  currency: string;
  recoveredAt: string | null;
  recoveryEmailSentAt: string | null;
  createdAt: string;
}

export function listAbandonedCarts(params: { recovered?: boolean; limit?: number; cursor?: string }) {
  return api.get<{ items: AbandonedCartRow[]; nextCursor: string | null; hasMore: boolean }>(
    '/marketing/abandoned-carts',
    params,
  );
}

export function sendAbandonedCartEmail(id: string) {
  return api.post<{ id: string; sent: boolean }>(`/marketing/abandoned-carts/${id}/send-email`);
}

// ------- Inventory ---------------------------------------------------------

export type InventoryStatus = 'in_stock' | 'low' | 'out';

export interface InventoryLevelRow {
  variantId: string;
  sku: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  priceMinorUnits: string;
  currency: string;
  stockOnHand: number;
  stockReserved: number;
  available: number;
  lowStockThreshold: number;
  status: InventoryStatus;
}

export type InventoryMovementType =
  | 'ADJUSTMENT'
  | 'RESERVATION'
  | 'RELEASE'
  | 'FULFILLMENT'
  | 'RETURN'
  | 'DAMAGE'
  | 'INITIAL';

export interface InventoryMovementRow {
  id: string;
  variantId: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string | null;
  reference: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export function listInventoryLevels(params: {
  query?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  page?: number;
  limit?: number;
}): Promise<{
  items: InventoryLevelRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  return api.get('/inventory/levels', {
    query: params.query,
    lowStock: params.lowStock,
    outOfStock: params.outOfStock,
    page: params.page ?? 1,
    limit: params.limit ?? 25,
  });
}

export function getInventoryLevel(variantId: string) {
  return api.get<{
    variantId: string;
    stockOnHand: number;
    stockReserved: number;
    available: number;
    lowStockThreshold: number;
  }>(`/inventory/levels/${variantId}`);
}

export function updateInventoryThreshold(
  variantId: string,
  lowStockThreshold: number,
) {
  return api.patch<{
    variantId: string;
    stockOnHand: number;
    stockReserved: number;
    lowStockThreshold: number;
  }>(`/inventory/levels/${variantId}`, { lowStockThreshold });
}

export function adjustStock(input: {
  variantId: string;
  delta: number;
  reason?: string;
  note?: string | null;
  reference?: string | null;
}) {
  return api.post<{
    variantId: string;
    stockOnHand: number;
    stockReserved: number;
    available: number;
  }>('/inventory/adjust', input);
}

export function listMovements(params: {
  variantId?: string;
  type?: InventoryMovementType;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<{
  items: InventoryMovementRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  return api.get('/inventory/movements', {
    variantId: params.variantId,
    type: params.type,
    from: params.from,
    to: params.to,
    page: params.page ?? 1,
    limit: params.limit ?? 50,
  });
}

export function listLowStock() {
  return api.get<
    Array<{
      variantId: string;
      sku: string;
      productTitle: string;
      stockOnHand: number;
      stockReserved: number;
      lowStockThreshold: number;
      available: number;
    }>
  >('/inventory/low-stock');
}

export function bulkImportInventory(items: Array<{ variantSku: string; stockOnHand: number; lowStockThreshold?: number }>) {
  return api.post<{
    succeeded: number;
    failed: Array<{ sku: string; reason: string }>;
  }>('/inventory/bulk-import', { items });
}
