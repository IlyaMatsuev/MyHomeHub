import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthConfigService } from 'auth/auth-config.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly authConfig: AuthConfigService) {
        super();
    }

    canActivate(context: ExecutionContext) {
        // Auth only protects the REST API. Non-HTTP contexts (e.g. MQTT/Zigbee
        // @MessagePattern handlers) carry no JWT, so guarding them would block
        // internal device state updates from ever reaching DevicesService.
        if (context.getType() !== 'http') {
            return true;
        }
        if (this.authConfig.isPublicEndpoint(context) || !this.authConfig.isAuthEnabled()) {
            return true;
        }
        return super.canActivate(context);
    }
}
