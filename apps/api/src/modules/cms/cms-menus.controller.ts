import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateCmsMenuSchema, type UpdateCmsMenuInput } from '@ecf/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CheckAbility } from '../../common/rbac/permissions.decorator';
import { CmsService } from './cms.service';

const MENU_KEY_REGEX = /^[a-z0-9][a-z0-9_-]{0,31}$/;

@ApiTags('cms/menus')
@ApiBearerAuth()
@Controller('cms/menus')
@UseGuards(JwtGuard, PermissionsGuard)
export class CmsMenusController {
  constructor(private readonly cms: CmsService) {}

  @ApiOperation({ summary: 'List CMS menus (admin)' })
  @CheckAbility({ action: 'read', subject: 'CmsMenu' })
  @Get()
  list() {
    return this.cms.listMenus();
  }

  @ApiOperation({ summary: 'Get CMS menu by key (admin)' })
  @CheckAbility({ action: 'read', subject: 'CmsMenu' })
  @Get(':key')
  findOne(@Param('key') key: string) {
    assertKey(key);
    return this.cms.getMenuByKey(key);
  }

  @ApiOperation({ summary: 'Update CMS menu items (admin)' })
  @CheckAbility({ action: 'update', subject: 'CmsMenu' })
  @Patch(':key')
  update(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(UpdateCmsMenuSchema)) body: UpdateCmsMenuInput,
  ) {
    assertKey(key);
    return this.cms.updateMenu(key, body);
  }
}

function assertKey(key: string): void {
  if (!MENU_KEY_REGEX.test(key)) {
    throw new Error(`Invalid menu key: ${key}`);
  }
}
