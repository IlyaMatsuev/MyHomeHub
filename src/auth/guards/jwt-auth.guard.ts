import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { isLocalAuthBypass, isPublicEndpoint } from 'auth/guards/auth-bypass.helper';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
    ) {
        super();
    }

    canActivate(context: ExecutionContext) {
        if (isPublicEndpoint(this.reflector, context) || isLocalAuthBypass(this.configService)) {
            return true;
        }
        return super.canActivate(context);
    }
}
