import { describe, it, expect } from 'vitest';
import { AbilityFactory, type AbilityContext } from './ability.factory';
import type { RoleCode } from '@ecf/types';

/**
 * Unit tests for the CASL ability factory. No harness / DB / HTTP needed —
 * ability creation is pure. These tests pin the RBAC matrix so a future
 * refactor can't silently widen a role's permissions.
 */
describe('AbilityFactory', () => {
  const factory = new AbilityFactory();

  const buildStaff = (roles: RoleCode[]): AbilityContext => ({
    audience: 'staff',
    roles,
    userId: 'u1',
    tenantId: 't1',
    customerId: null,
  });

  const buildCustomer = (customerId: string | null): AbilityContext => ({
    audience: 'customer',
    roles: ['CUSTOMER'],
    userId: 'u2',
    tenantId: 't1',
    customerId,
  });

  const buildLandlord = (): AbilityContext => ({
    audience: 'landlord',
    roles: ['OWNER'],
    userId: 'l1',
    tenantId: null,
    customerId: null,
  });

  describe('landlord audience', () => {
    it('has manage/all across every subject', () => {
      const ab = factory.createForUser(buildLandlord());
      expect(ab.can('manage', 'all')).toBe(true);
      expect(ab.can('delete', 'Tenant')).toBe(true);
      expect(ab.can('update', 'Plan')).toBe(true);
      expect(ab.can('create', 'Product')).toBe(true);
    });
  });

  describe('OWNER staff', () => {
    it('has full access across every subject', () => {
      const ab = factory.createForUser(buildStaff(['OWNER']));
      expect(ab.can('manage', 'all')).toBe(true);
      expect(ab.can('delete', 'Tenant')).toBe(true);
      expect(ab.can('update', 'Plan')).toBe(true);
    });
  });

  describe('ADMIN staff', () => {
    it('has manage/all but cannot delete Tenant', () => {
      const ab = factory.createForUser(buildStaff(['ADMIN']));
      expect(ab.can('manage', 'all')).toBe(true);
      expect(ab.can('update', 'Product')).toBe(true);
      expect(ab.can('delete', 'Tenant')).toBe(false);
    });
  });

  describe('PRODUCT_MANAGER staff', () => {
    it('has CRUD on catalog subjects and read on orders', () => {
      const ab = factory.createForUser(buildStaff(['PRODUCT_MANAGER']));
      expect(ab.can('create', 'Product')).toBe(true);
      expect(ab.can('update', 'Product')).toBe(true);
      expect(ab.can('delete', 'Product')).toBe(true);
      expect(ab.can('create', 'ProductVariant')).toBe(true);
      expect(ab.can('create', 'Category')).toBe(true);
      expect(ab.can('create', 'Brand')).toBe(true);
      expect(ab.can('create', 'MediaAsset')).toBe(true);
      expect(ab.can('read', 'Order')).toBe(true);
    });

    it('cannot update orders or tenant settings', () => {
      const ab = factory.createForUser(buildStaff(['PRODUCT_MANAGER']));
      expect(ab.can('update', 'Order')).toBe(false);
      expect(ab.can('update', 'Tenant')).toBe(false);
      expect(ab.can('delete', 'Tenant')).toBe(false);
    });
  });

  describe('ORDER_OPERATOR staff', () => {
    it('reads + updates orders, reads customer + catalog', () => {
      const ab = factory.createForUser(buildStaff(['ORDER_OPERATOR']));
      expect(ab.can('read', 'Order')).toBe(true);
      expect(ab.can('update', 'Order')).toBe(true);
      expect(ab.can('read', 'Customer')).toBe(true);
      expect(ab.can('read', 'CustomerAddress')).toBe(true);
      expect(ab.can('read', 'Product')).toBe(true);
      expect(ab.can('read', 'ProductVariant')).toBe(true);
    });

    it('cannot create or delete products or delete orders', () => {
      const ab = factory.createForUser(buildStaff(['ORDER_OPERATOR']));
      expect(ab.can('create', 'Product')).toBe(false);
      expect(ab.can('delete', 'Product')).toBe(false);
      expect(ab.can('delete', 'Order')).toBe(false);
      expect(ab.can('create', 'Order')).toBe(false);
    });
  });

  describe('VIEWER staff', () => {
    it('reads everything, writes nothing', () => {
      const ab = factory.createForUser(buildStaff(['VIEWER']));
      expect(ab.can('read', 'Product')).toBe(true);
      expect(ab.can('read', 'Order')).toBe(true);
      expect(ab.can('read', 'Customer')).toBe(true);
      expect(ab.can('create', 'Product')).toBe(false);
      expect(ab.can('update', 'Order')).toBe(false);
      expect(ab.can('delete', 'Customer')).toBe(false);
    });
  });

  describe('customer audience', () => {
    it('reads catalog regardless of customerId', () => {
      const ab = factory.createForUser(buildCustomer(null));
      expect(ab.can('read', 'Product')).toBe(true);
      expect(ab.can('read', 'Category')).toBe(true);
      expect(ab.can('read', 'Brand')).toBe(true);
    });

    it('can create+read+update a Cart (even as anonymous)', () => {
      const ab = factory.createForUser(buildCustomer(null));
      expect(ab.can('create', 'Cart')).toBe(true);
      expect(ab.can('read', 'Cart')).toBe(true);
      expect(ab.can('update', 'Cart')).toBe(true);
    });

    it('without customerId has no Order/CustomerAddress/Customer access', () => {
      const ab = factory.createForUser(buildCustomer(null));
      expect(ab.can('read', 'Order')).toBe(false);
      expect(ab.can('create', 'Order')).toBe(false);
      expect(ab.can('read', 'CustomerAddress')).toBe(false);
      expect(ab.can('manage', 'CustomerAddress')).toBe(false);
      expect(ab.can('read', 'Customer')).toBe(false);
    });

    it('with customerId gets Order create/read and CustomerAddress manage', () => {
      const ab = factory.createForUser(buildCustomer('c1'));
      // CASL 6 on string-subject + conditions: subject-level can() returns true
      // because at least one rule grants the action with a condition attached.
      expect(ab.can('create', 'Order')).toBe(true);
      expect(ab.can('read', 'Order')).toBe(true);
      expect(ab.can('manage', 'CustomerAddress')).toBe(true);
      expect(ab.can('read', 'Customer')).toBe(true);
      expect(ab.can('update', 'Customer')).toBe(true);
      expect(ab.can('delete', 'Customer')).toBe(true);
      expect(ab.can('create', 'KvkkConsent')).toBe(true);
    });

    it('cannot manage Products / Tenant / Role / User', () => {
      const ab = factory.createForUser(buildCustomer('c1'));
      expect(ab.can('create', 'Product')).toBe(false);
      expect(ab.can('update', 'Product')).toBe(false);
      expect(ab.can('delete', 'Tenant')).toBe(false);
      expect(ab.can('manage', 'Role')).toBe(false);
      expect(ab.can('manage', 'User')).toBe(false);
    });
  });

  describe('empty / unknown role falls through safely', () => {
    it('staff with empty roles array has no abilities', () => {
      const ab = factory.createForUser(buildStaff([]));
      expect(ab.can('read', 'Product')).toBe(false);
      expect(ab.can('manage', 'all')).toBe(false);
    });

    it('staff with CUSTOMER role code (illegal) grants nothing', () => {
      const ab = factory.createForUser(buildStaff(['CUSTOMER']));
      expect(ab.can('read', 'Product')).toBe(false);
      expect(ab.can('read', 'Order')).toBe(false);
    });
  });
});
