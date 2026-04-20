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
