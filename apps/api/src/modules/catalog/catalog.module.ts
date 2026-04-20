import { Module } from '@nestjs/common';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { ProductsRepository } from './products/products.repository';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { BrandsController } from './brands/brands.controller';
import { BrandsService } from './brands/brands.service';
import { TagsController } from './tags/tags.controller';
import { TagsService } from './tags/tags.service';
import { SearchController } from './search/search.controller';
import { SearchService } from './search/search.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { AbilityFactory } from '../../common/rbac/ability.factory';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    ProductsService,
    ProductsRepository,
    CategoriesService,
    BrandsService,
    TagsService,
    SearchService,
    TenantContextService,
    AbilityFactory,
    PermissionsGuard,
    JwtGuard,
  ],
  controllers: [
    ProductsController,
    CategoriesController,
    BrandsController,
    TagsController,
    SearchController,
  ],
  exports: [ProductsService, CategoriesService, BrandsService, SearchService],
})
export class CatalogModule {}
