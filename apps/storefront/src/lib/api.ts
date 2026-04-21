import { API_PREFIX, API_URL, DEFAULT_TENANT_SLUG } from './env';
import type {
  Address,
  Brand,
  Cart,
  Category,
  CheckoutSession,
  Order,
  OrderSummary,
  Paginated,
  Product,
  ProductListQuery,
  ProductSummary,
  ShippingMethod,
} from './types';

export interface FetcherOptions extends RequestInit {
  tenantSlug?: string;
  /** When true, revalidate=0, default is 'no-store' for personalized routes */
  revalidate?: number | false;
}

/**
 * Generic fetcher. Automatically attaches X-Tenant-Slug and credentials.
 * Works both on server (RSC) and client components.
 */
export async function fetcher<T>(
  path: string,
  options: FetcherOptions = {},
): Promise<T> {
  const { tenantSlug, revalidate, headers, ...init } = options;

  const url = path.startsWith('http')
    ? path
    : `${API_URL}${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Tenant-Slug': tenantSlug ?? DEFAULT_TENANT_SLUG,
    ...(headers as Record<string, string> | undefined),
  };

  const nextOpts =
    revalidate === false
      ? { cache: 'no-store' as const }
      : typeof revalidate === 'number'
        ? { next: { revalidate } }
        : { cache: 'no-store' as const };

  const res = await fetch(url, {
    ...init,
    headers: finalHeaders,
    credentials: 'include',
    ...nextOpts,
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    const err = new Error(
      `API ${res.status} ${res.statusText} :: ${path}`,
    ) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: object): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === '') continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

type FetchOpts = Pick<FetcherOptions, 'tenantSlug' | 'revalidate'>;

export const api = {
  products: {
    list: (q: ProductListQuery = {}, opts: FetchOpts = {}) =>
      fetcher<Paginated<ProductSummary>>(`/products${qs(q)}`, opts),
    get: (slugOrId: string, opts: FetchOpts = {}) =>
      fetcher<Product>(`/products/${encodeURIComponent(slugOrId)}`, opts),
    search: (q: string, opts: FetchOpts = {}) =>
      fetcher<Paginated<ProductSummary>>(
        `/search/products${qs({ q })}`,
        opts,
      ),
  },

  categories: {
    tree: (opts: FetchOpts = {}) =>
      fetcher<Category[]>('/categories/tree', { revalidate: 300, ...opts }),
    list: (opts: FetchOpts = {}) =>
      fetcher<Category[]>('/categories', { revalidate: 300, ...opts }),
    get: (slugOrId: string, opts: FetchOpts = {}) =>
      fetcher<Category>(`/categories/${encodeURIComponent(slugOrId)}`, opts),
  },

  brands: {
    list: (opts: FetchOpts = {}) =>
      fetcher<Brand[]>('/brands', { revalidate: 300, ...opts }),
  },

  cart: {
    get: (opts: FetchOpts = {}) =>
      fetcher<Cart>('/cart', { revalidate: false, ...opts }),
    addItem: (input: { variantId: string; quantity: number }) =>
      fetcher<Cart>('/cart/items', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateItem: (variantId: string, quantity: number) =>
      fetcher<Cart>(`/cart/items/${encodeURIComponent(variantId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      }),
    removeItem: (variantId: string) =>
      fetcher<Cart>(`/cart/items/${encodeURIComponent(variantId)}`, {
        method: 'DELETE',
      }),
    merge: () => fetcher<Cart>('/cart/merge', { method: 'POST' }),
    applyCoupon: (code: string) =>
      fetcher<Cart>('/cart/coupon', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    removeCoupon: (code: string) =>
      fetcher<Cart>(`/cart/coupon/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      }),
  },

  checkout: {
    start: () =>
      fetcher<CheckoutSession>('/checkout/start', { method: 'POST' }),
    get: (token: string) =>
      fetcher<CheckoutSession>(`/checkout/${encodeURIComponent(token)}`, {
        revalidate: false,
      }),
    setAddress: (token: string, address: Address) =>
      fetcher<CheckoutSession>(
        `/checkout/${encodeURIComponent(token)}/address`,
        { method: 'POST', body: JSON.stringify(address) },
      ),
    setShipping: (token: string, method: ShippingMethod['code']) =>
      fetcher<CheckoutSession>(
        `/checkout/${encodeURIComponent(token)}/shipping`,
        { method: 'POST', body: JSON.stringify({ method }) },
      ),
    setPayment: (token: string, method: 'cod' | 'stub_card') =>
      fetcher<CheckoutSession>(
        `/checkout/${encodeURIComponent(token)}/payment`,
        { method: 'POST', body: JSON.stringify({ method }) },
      ),
    complete: (token: string) =>
      fetcher<{ orderId: string; orderNumber: string }>(
        `/checkout/${encodeURIComponent(token)}/complete`,
        { method: 'POST' },
      ),
  },

  orders: {
    me: (opts: FetchOpts = {}) =>
      fetcher<Paginated<OrderSummary>>('/customers/me/orders', {
        revalidate: false,
        ...opts,
      }),
    get: (id: string, opts: FetchOpts = {}) =>
      fetcher<Order>(`/customers/me/orders/${encodeURIComponent(id)}`, {
        revalidate: false,
        ...opts,
      }),
    cancel: (id: string) =>
      fetcher<Order>(
        `/customers/me/orders/${encodeURIComponent(id)}/cancel`,
        { method: 'POST' },
      ),
    refundRequest: (
      id: string,
      body: {
        reason: string;
        reasonCategory?:
          | 'DAMAGED'
          | 'WRONG_ITEM'
          | 'SIZE_ISSUE'
          | 'NOT_AS_DESCRIBED'
          | 'CHANGED_MIND'
          | 'OTHER';
        requestedAmount?: string;
        itemSelections?: { orderItemId: string; qty: number; amount: string }[];
      },
    ) =>
      fetcher<{ id: string; status: string }>(
        `/customers/me/orders/${encodeURIComponent(id)}/refund-request`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
  },

  customer: {
    me: (opts: FetchOpts = {}) =>
      fetcher<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        phone?: string;
      }>('/customers/me', { revalidate: false, ...opts }),
    updateMe: (data: Partial<{ firstName: string; lastName: string; phone: string }>) =>
      fetcher('/customers/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteMe: () =>
      fetcher('/customers/me', { method: 'DELETE' }),
    addresses: {
      list: () => fetcher<Address[]>('/customers/me/addresses', { revalidate: false }),
      create: (a: Address) =>
        fetcher<Address>('/customers/me/addresses', {
          method: 'POST',
          body: JSON.stringify(a),
        }),
      update: (id: string, a: Partial<Address>) =>
        fetcher<Address>(`/customers/me/addresses/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(a),
        }),
      remove: (id: string) =>
        fetcher(`/customers/me/addresses/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
    },
    kvkk: {
      consent: (accepted: boolean) =>
        fetcher('/customers/me/kvkk/consent', {
          method: 'POST',
          body: JSON.stringify({ accepted }),
        }),
      requestExport: () =>
        fetcher('/customers/me/kvkk/export', { method: 'POST' }),
      requestDelete: () =>
        fetcher('/customers/me/kvkk/delete', { method: 'POST' }),
    },
  },

  cms: {
    listPages: (location?: 'header' | 'footer', opts: FetchOpts = {}) =>
      fetcher<
        Array<{
          id: string;
          slug: string;
          title: string;
          showInFooter: boolean;
          showInHeader: boolean;
          sortOrder: number;
          updatedAt: string;
        }>
      >(`/public/pages${location ? `?location=${location}` : ''}`, {
        revalidate: 300,
        ...opts,
      }),
    getPage: (slug: string, opts: FetchOpts = {}) =>
      fetcher<{
        id: string;
        slug: string;
        title: string;
        content: string;
        metaTitle: string | null;
        metaDescription: string | null;
        publishedAt: string | null;
        updatedAt: string;
      }>(`/public/pages/${encodeURIComponent(slug)}`, {
        revalidate: 300,
        ...opts,
      }),
    getMenu: (key: string, opts: FetchOpts = {}) =>
      fetcher<{
        key: string;
        name: string;
        items: Array<{
          label: string;
          type: 'page' | 'category' | 'url';
          target: string;
          sortOrder?: number;
        }>;
        isActive: boolean;
      }>(`/public/menus/${encodeURIComponent(key)}`, {
        revalidate: 300,
        ...opts,
      }),
  },

  seo: {
    checkRedirect: (
      path: string,
      opts: FetchOpts = {},
    ): Promise<{ redirect: string | null; status: number | null }> =>
      fetcher(`/public/redirects/check?path=${encodeURIComponent(path)}`, {
        revalidate: 300,
        ...opts,
      }),
    getSettings: (opts: FetchOpts = {}) =>
      fetcher<{
        defaultTitle: string | null;
        titleTemplate: string | null;
        defaultDescription: string | null;
        defaultOgImage: string | null;
        googleSiteVerification: string | null;
        bingSiteVerification: string | null;
      }>('/public/seo/settings', { revalidate: 300, ...opts }),
  },

  i18n: {
    bundle: (
      lang: string,
      ns: string,
      opts: FetchOpts = {},
    ): Promise<{
      lang: string;
      namespace: string;
      strings: Record<string, string>;
      version: number;
    }> =>
      fetcher(
        `/public/i18n/bundle?lang=${encodeURIComponent(lang)}&ns=${encodeURIComponent(ns)}`,
        { revalidate: 300, ...opts },
      ),
    languages: (opts: FetchOpts = {}) =>
      fetcher<
        Array<{
          code: string;
          name: string;
          nativeName: string;
          rtl: boolean;
          isDefault: boolean;
        }>
      >('/public/i18n/languages', { revalidate: 300, ...opts }),
  },

  auth: {
    login: (email: string, password: string) =>
      fetcher<{ accessToken: string; refreshToken?: string }>(
        '/auth/customer/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      ),
    register: (input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) =>
      fetcher<{ accessToken: string }>('/auth/customer/register', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    logout: () => fetcher('/auth/logout', { method: 'POST' }),
    refresh: () => fetcher('/auth/refresh', { method: 'POST' }),
  },

  reviews: {
    stats: (productId: string, opts: FetchOpts = {}) =>
      fetcher<{
        average: number;
        count: number;
        distribution: Record<string, number>;
      }>(`/products/${encodeURIComponent(productId)}/reviews/stats`, {
        revalidate: 60,
        ...opts,
      }),
    list: (
      productId: string,
      q: { sort?: 'newest' | 'highest' | 'lowest'; page?: number; pageSize?: number } = {},
      opts: FetchOpts = {},
    ) =>
      fetcher<{
        items: Array<{
          id: string;
          rating: number;
          title: string | null;
          comment: string | null;
          isVerifiedBuyer: boolean;
          helpfulCount: number;
          createdAt: string;
          authorName: string;
        }>;
        total: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
      }>(`/products/${encodeURIComponent(productId)}/reviews${qs(q)}`, {
        revalidate: 60,
        ...opts,
      }),
    create: (productId: string, body: { rating: number; title?: string; comment?: string }) =>
      fetcher<{ id: string; status: string }>(
        `/products/${encodeURIComponent(productId)}/reviews`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    markHelpful: (id: string) =>
      fetcher<{ id: string; helpfulCount: number }>(
        `/reviews/${encodeURIComponent(id)}/helpful`,
        { method: 'POST' },
      ),
  },

  wishlist: {
    list: (opts: FetchOpts = {}) =>
      fetcher<
        Array<{
          productId: string;
          variantId: string | null;
          addedAt: string;
          product: {
            id: string;
            slug: string;
            title: string;
            status: string;
            brand: { id: string; name: string } | null;
            priceMinor: string | null;
            compareAtMinor: string | null;
            currency: string | null;
            inStock: boolean;
            defaultVariantId: string | null;
            image: { id: string; url: string; key: string } | null;
          } | null;
        }>
      >('/customers/me/wishlist', { revalidate: false, ...opts }),
    add: (productId: string, variantId?: string) =>
      fetcher('/customers/me/wishlist', {
        method: 'POST',
        body: JSON.stringify({ productId, variantId }),
      }),
    remove: (productId: string) =>
      fetcher(`/customers/me/wishlist/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      }),
    moveToCart: () =>
      fetcher<{ moved: number; skipped: Array<{ productId: string; reason: string }> }>(
        '/customers/me/wishlist/move-to-cart',
        { method: 'POST' },
      ),
  },

  cartRecover: {
    resume: (recoverToken: string) =>
      fetcher<{ recovered: boolean; items: number }>(
        `/cart/recover/${encodeURIComponent(recoverToken)}`,
        { method: 'POST' },
      ),
  },
};
