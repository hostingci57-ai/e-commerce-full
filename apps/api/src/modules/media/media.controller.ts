import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateMediaAssetSchema,
  ListMediaAssetsQuerySchema,
  PresignedUploadSchema,
  type CreateMediaAssetInput,
  type ListMediaAssetsQuery,
  type PresignedUploadInput,
} from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
@UseGuards(JwtGuard, PermissionsGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @ApiOperation({ summary: 'Issue presigned PUT URL for direct-to-S3 upload' })
  @CheckAbility({ action: 'create', subject: 'MediaAsset' })
  @Post('presigned-url')
  presign(
    @Body(new ZodValidationPipe(PresignedUploadSchema))
    body: PresignedUploadInput,
  ) {
    return this.media.generateUploadUrl(body);
  }

  @ApiOperation({ summary: 'Record asset after client-side upload completes' })
  @CheckAbility({ action: 'create', subject: 'MediaAsset' })
  @Post('assets')
  createAsset(
    @Body(new ZodValidationPipe(CreateMediaAssetSchema))
    body: CreateMediaAssetInput,
  ) {
    return this.media.createAsset(body);
  }

  @ApiOperation({ summary: 'List assets (cursor paginated)' })
  @CheckAbility({ action: 'read', subject: 'MediaAsset' })
  @Get('assets')
  list(
    @Query(new ZodValidationPipe(ListMediaAssetsQuerySchema))
    q: ListMediaAssetsQuery,
  ) {
    return this.media.list(q);
  }

  @ApiOperation({ summary: 'Get a time-limited signed GET URL' })
  @CheckAbility({ action: 'read', subject: 'MediaAsset' })
  @Get('assets/:id/signed-url')
  signedUrl(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.media.getSignedUrl(id);
  }

  @ApiOperation({ summary: 'Delete asset' })
  @CheckAbility({ action: 'delete', subject: 'MediaAsset' })
  @Delete('assets/:id')
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.media.delete(id);
  }
}
