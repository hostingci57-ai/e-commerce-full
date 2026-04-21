import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability';
import type { RoleCode } from '@ecf/types';

/**
 * Subject catalogue — extend as new resources are added.
 * Using string literals (rather than class refs) so DTO types don't leak here.
 */
export type Subject =
  | 'all'
  | 'Tenant'
  | 'Plan'
  | 'User'
  | 'Product'
  | 'ProductVariant'
  | 'Category'
  | 'Brand'
  | 'MediaAsset'
  | 'Customer'
  | 'CustomerAddress'
  | 'KvkkConsent'
  | 'Order'
  | 'Cart'
  | 'TenantMember'
  | 'Role'
  | 'Coupon'
  | 'Refund'
  | 'CmsPage'
  | 'CmsMenu'
  | 'Redirect'
  | 'SeoSetting'
  | 'Language'
  | 'TenantLanguage'
  | 'UiStringBundle';

export type Action = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'invite';
export type AppAbility = MongoAbility<[Action, Subject]>;

export interface AbilityContext {
  audience: 'customer' | 'staff' | 'landlord';
  roles: RoleCode[];
  userId: string | null;
  tenantId: string | null;
  customerId: string | null;
}

@Injectable()
export class AbilityFactory {
  createForUser(ctx: AbilityContext): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (ctx.audience === 'landlord') {
      can('manage', 'all');
      return build();
    }

    if (ctx.audience === 'customer') {
      can('read', 'Product');
      can('read', 'Category');
      can('read', 'Brand');
      can(['create', 'read', 'update'], 'Cart');
      if (ctx.customerId) {
        // Casl 6 narrows conditions from the Subject union; cast since our
        // subjects are bare string literals without a schema attached.
        (can as unknown as (a: Action | Action[], s: Subject, c?: unknown) => unknown)(
          ['create', 'read'],
          'Order',
          { customerId: ctx.customerId },
        );
        (can as unknown as (a: Action | Action[], s: Subject, c?: unknown) => unknown)(
          'manage',
          'CustomerAddress',
          { customerId: ctx.customerId },
        );
        (can as unknown as (a: Action | Action[], s: Subject, c?: unknown) => unknown)(
          ['read', 'update', 'delete'],
          'Customer',
          { id: ctx.customerId },
        );
        can(['create', 'read'], 'KvkkConsent');
      }
      return build();
    }

    // staff — union over roles
    for (const role of ctx.roles) {
      switch (role) {
        case 'OWNER':
          can('manage', 'all');
          break;
        case 'ADMIN':
          can('manage', 'all');
          cannot('delete', 'Tenant');
          break;
        case 'PRODUCT_MANAGER':
          can(['create', 'read', 'update', 'delete'], 'Product');
          can(['create', 'read', 'update', 'delete'], 'ProductVariant');
          can(['create', 'read', 'update', 'delete'], 'Category');
          can(['create', 'read', 'update', 'delete'], 'Brand');
          can(['create', 'read', 'update', 'delete'], 'MediaAsset');
          can('read', 'Order');
          break;
        case 'ORDER_OPERATOR':
          can('read', 'Order');
          can('update', 'Order');
          can('create', 'Order');
          can('read', 'Customer');
          can('read', 'CustomerAddress');
          can('read', 'Product');
          can('read', 'ProductVariant');
          can('read', 'Category');
          can('read', 'Brand');
          can(['create', 'read', 'update', 'delete'], 'Coupon');
          can(['read', 'update'], 'Refund');
          can(['create', 'read', 'update', 'delete'], 'CmsPage');
          can(['read', 'update'], 'CmsMenu');
          can(['create', 'read', 'update', 'delete'], 'Redirect');
          can(['read', 'update'], 'SeoSetting');
          can(['read', 'update'], 'TenantLanguage');
          can(['read', 'update'], 'UiStringBundle');
          break;
        case 'VIEWER':
          can('read', 'all');
          break;
        case 'CUSTOMER':
          // staff row with CUSTOMER role code should not exist but be safe
          break;
        default:
          break;
      }
    }

    return build();
  }
}
