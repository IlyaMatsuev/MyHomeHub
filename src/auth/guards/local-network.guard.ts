import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import ipaddr from 'ipaddr.js';
import { AuthConfigService } from 'auth/auth-config.service';
import { LOCAL_IP_RANGES } from 'auth/auth.constants';

@Injectable()
export class LocalNetworkGuard implements CanActivate {
    private readonly logger = new Logger(LocalNetworkGuard.name);

    constructor(private readonly authConfig: AuthConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        // Non-HTTP contexts (e.g. MQTT/Zigbee controllers) have no client address
        if (context.getType() !== 'http') {
            return true;
        }
        if (!this.authConfig.isLocalNetworkOnlyEndpoint(context)) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        if (this.isLocalAddress(request?.ip ?? request?.socket?.remoteAddress)) {
            return true;
        }

        this.logger.debug(`Rejected a request to ${request?.originalUrl} from a non-local address ${request?.ip}`);

        throw new ForbiddenException('This endpoint is only accessible from the local network');
    }

    private isLocalAddress(ip?: string): boolean {
        if (!ip?.trim()) {
            return false;
        }
        try {
            return LOCAL_IP_RANGES.includes(ipaddr.process(ip.trim()).range());
        } catch {
            return false;
        }
    }
}
