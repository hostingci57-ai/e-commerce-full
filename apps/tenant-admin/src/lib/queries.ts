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
