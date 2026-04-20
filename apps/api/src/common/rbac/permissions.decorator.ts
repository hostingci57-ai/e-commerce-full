import { SetMetadata } from '@nestjs/common';
import type { Action, Subject } from './ability.factory';

export interface RequiredAbility {
  action: Action;
  subject: Subject;
}

export const ABILITIES_KEY = 'ecf:abilities';
export const CheckAbility = (
  ...abilities: RequiredAbility[]
): ClassDecorator & MethodDecorator => SetMetadata(ABILITIES_KEY, abilities);
