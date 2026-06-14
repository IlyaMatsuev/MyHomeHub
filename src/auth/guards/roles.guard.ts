import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from 'auth/interfaces';
import { ROLES_KEY } from 'auth/decorators';
import { isLocalAuthBypass, isPublicEndpoint } from 'auth/guards/auth-bypass.helper';
import { UserRole } from 'users/interfaces';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        if (isPublicEndpoint(this.reflector, context) || isLocalAuthBypass(this.configService)) {
            return true;
        }

        const requiredRoles = this.reflector.getAllAndOverride<Array<UserRole>>(ROLES_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
        if (!user) {
            throw new ForbiddenException();
        }
        if (user.role === UserRole.Admin || requiredRoles.includes(user.role)) {
            return true;
        }

        throw new ForbiddenException();
    }
}
