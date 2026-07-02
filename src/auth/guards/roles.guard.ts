import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from 'auth/interfaces';
import { ROLES_KEY } from 'auth/decorators';
import { UserRole } from 'users/interfaces';
import { AuthConfigService } from 'auth/auth-config.service';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly authConfig: AuthConfigService,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        // Role checks only apply to the REST API
        // Non-HTTP contexts (e.g. MQTT/Zigbee controllers) have no authenticated user
        if (context.getType() !== 'http') {
            return true;
        }
        if (this.authConfig.isPublicEndpoint(context) || !this.authConfig.isAuthEnabled()) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
        if (!user) {
            throw new ForbiddenException();
        }

        const requiredRoles = this.reflector.getAllAndOverride<Array<UserRole>>(ROLES_KEY, [context.getHandler(), context.getClass()]);
        if (user.role === UserRole.Admin || (requiredRoles?.length && requiredRoles.includes(user.role))) {
            return true;
        }

        throw new ForbiddenException();
    }
}
