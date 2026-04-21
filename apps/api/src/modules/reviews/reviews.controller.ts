import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateReviewSchema,
  ListAdminReviewsQuerySchema,
  ListPublicReviewsQuerySchema,
  RejectReviewSchema,
  type CreateReviewInput,
  type ListAdminReviewsQuery,
  type ListPublicReviewsQuery,
  type RejectReviewInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { ReviewsService } from './reviews.service';

// ---------------------------------------------------------------------------
// Public (storefront) — per-product review list + stats + create (customer auth)
// ---------------------------------------------------------------------------

@ApiTags('product-reviews')
@Controller('products/:productId/reviews')
export class ProductReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @ApiOperation({ summary: 'List approved reviews for a product' })
  @Get()
  list(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Query(new ZodValidationPipe(ListPublicReviewsQuerySchema)) q: ListPublicReviewsQuery,
  ) {
    return this.reviews.listPublic(productId, q);
  }

  @ApiOperation({ summary: 'Aggregate rating stats (avg, count, distribution)' })
  @Get('stats')
  stats(@Param('productId', new ParseUUIDPipe()) productId: string) {
    return this.reviews.getStats(productId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review (customer auth)' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'create', subject: 'ProductReview' })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body(new ZodValidationPipe(CreateReviewSchema)) body: CreateReviewInput,
  ) {
    return this.reviews.create(productId, body);
  }
}

// ---------------------------------------------------------------------------
// Admin / helpful / self-delete — flat routes under /reviews/:id
// ---------------------------------------------------------------------------

@ApiTags('reviews-admin')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin list of reviews (all statuses)' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'read', subject: 'ProductReview' })
  @Get()
  list(@Query(new ZodValidationPipe(ListAdminReviewsQuerySchema)) q: ListAdminReviewsQuery) {
    return this.reviews.listAdmin(q);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin review detail' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'read', subject: 'ProductReview' })
  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviews.findByIdAdmin(id);
  }

  @ApiOperation({ summary: 'Mark review as helpful (+1 counter, public endpoint)' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/helpful')
  helpful(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviews.markHelpful(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: approve a pending review' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'update', subject: 'ProductReview' })
  @Patch(':id/approve')
  approve(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviews.approve(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: reject a review' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'update', subject: 'ProductReview' })
  @Patch(':id/reject')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(RejectReviewSchema)) body: RejectReviewInput,
  ) {
    return this.reviews.reject(id, body);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete review (admin or owner)' })
  @UseGuards(JwtGuard, PermissionsGuard)
  @CheckAbility({ action: 'delete', subject: 'ProductReview' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reviews.remove(id);
  }
}
