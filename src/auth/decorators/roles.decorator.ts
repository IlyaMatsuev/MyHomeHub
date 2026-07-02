import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'users/interfaces';

export const ROLES_KEY = 'forRoles';

export const ForRoles = (...roles: Array<UserRole>) => SetMetadata(ROLES_KEY, roles);
