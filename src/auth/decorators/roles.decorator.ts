import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'users/interfaces';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Array<UserRole>) => SetMetadata(ROLES_KEY, roles);
