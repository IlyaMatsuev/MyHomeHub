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
        // The restriction only applies to the REST API
        // Non-HTTP contexts (e.g. MQTT/Zigbee controllers) have no client address
        if (context.getType() !== 'http') {
            return true;
        }
        if (!this.authConfig.isLocalNetworkOnlyEndpoint(context)) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        // `request.ip` relies on the express `trust proxy` setting (see TRUST_PROXY) to resolve
        // the real client IP from X-Forwarded-For when the server runs behind a reverse proxy
        if (this.isLocalAddress(request?.ip ?? request?.socket?.remoteAddress)) {
            return true;
        }

        // Logged on debug to not flood the logs when the server is being scanned from the internet
        this.logger.debug(`Rejected a request to ${request?.originalUrl} from a non-local address ${request?.ip}`);
        throw new ForbiddenException('This endpoint is only accessible from the local network');
    }

    // `ipaddr.process` unwraps IPv4-mapped IPv6 addresses (e.g. ::ffff:192.168.1.5) so they are
    // matched as IPv4, and an unresolvable address fails closed
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
