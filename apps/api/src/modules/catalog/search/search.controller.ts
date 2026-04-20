import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SearchProductsQuerySchema,
  type SearchProductsQuery,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../../common/rbac/permissions.guard';
import { CheckAbility } from '../../../common/rbac/permissions.decorator';
import { SearchService } from './search.service';

@ApiTags('catalog/search')
@ApiBearerAuth()
@Controller('search')
@UseGuards(JwtGuard, PermissionsGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @ApiOperation({ summary: 'Search products (PG ILIKE fallback; tsvector when migration lands)' })
  @CheckAbility({ action: 'read', subject: 'Product' })
  @Get('products')
  products(@Query(new ZodValidationPipe(SearchProductsQuerySchema)) query: SearchProductsQuery) {
    return this.search.searchProducts(query);
  }
}
