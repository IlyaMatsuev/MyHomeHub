import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthConfigService } from 'auth/auth-config.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly authConfig: AuthConfigService) {
        super();
    }

    canActivate(context: ExecutionContext) {
        if (this.authConfig.isPublicEndpoint(context) || !this.authConfig.isAuthEnabled()) {
            return true;
        }
        return super.canActivate(context);
    }
}
