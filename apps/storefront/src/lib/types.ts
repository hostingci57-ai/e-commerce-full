/**
 * Public UI shapes for the storefront. These mirror the backend's
 * serialized responses (see apps/api). We keep them colocated so the
 * storefront can evolve independently of server-only Prisma types.
 */

export interface Money {
  amount: number; // minor units
  currency: string; // ISO 4217
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string | null;
  position?: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name?: string | null;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  options: Record<string, string>; // { Color: 'red', Size: 'M' }
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  brand?: { id: string; name: string; slug: string } | null;
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  image?: ProductImage | null;
  inStock: boolean;
}

export interface Product extends ProductSummary {
  description?: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  categories: { id: string; slug: string; name: string }[];
  attributes?: Record<string, string>;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId?: string | null;
  children?: Category[];
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
}

export interface CartLine {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName?: string | null;
  image?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
}

export interface Cart {
  token?: string;
  lines: CartLine[];
  totals: CartTotals;
  couponCode?: string | null;
}

export interface Address {
  id?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string; // ISO-2, default 'TR'
  type?: 'shipping' | 'billing';
}

export interface ShippingMethod {
  code: 'standard' | 'express';
  label: string;
  price: number;
  etaDays: number;
}

export interface CheckoutSession {
  token: string;
  step: 'address' | 'shipping' | 'payment' | 'complete';
  address?: Address;
  shippingMethod?: ShippingMethod;
  paymentMethod?: 'cod' | 'stub_card';
  totals: CartTotals;
}

export type OrderStatus =
  | 'draft'
  | 'pending_payment'
  | 'payment_success'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'closed'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded'
  | 'partial_refunded';

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  currency: string;
  createdAt: string;
  itemCount: number;
}

export interface Order extends OrderSummary {
  lines: CartLine[];
  shippingAddress: Address;
  billingAddress?: Address;
  shippingMethod?: ShippingMethod;
  paymentMethod?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ProductListQuery {
  page?: number;
  pageSize?: number;
  category?: string;
  brand?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}
