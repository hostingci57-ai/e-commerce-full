/**
 * Public shapes returned by AnalyticsService. All monetary values are returned
 * as strings (BigInt → minor units) so the HTTP layer doesn't have to run the
 * BigIntSerializerInterceptor, and admin clients can parse as needed.
 *
 * Date inputs accepted by the service are ISO-8601 strings; the service
 * normalises them to UTC Date objects before hitting Prisma.
 */

export type Granularity = 'day' | 'week' | 'month';

export interface AnalyticsDateRange {
  /** Inclusive lower bound (ISO-8601). Defaults to 30 days ago. */
  from?: string;
  /** Inclusive upper bound (ISO-8601). Defaults to now. */
  to?: string;
}

export interface KpiResponse {
  revenueMinor: string;
  orderCount: number;
  newCustomerCount: number;
  /** Decimal in [0..1]; 0.0248 means 2.48%. */
  conversionRate: number;
  averageOrderValueMinor: string;
  /** Stub until a real sessions table lands. */
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
  /** Stubbed — requires abandoned cart detection job (Faz 8b). */
  abandonedCartCount: number;
  bankTransferPendingCount: number;
}
