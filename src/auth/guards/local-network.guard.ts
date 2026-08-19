import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_LOCAL_NETWORK_ONLY_KEY } from 'auth/decorators';
import { LocalNetworkService } from 'common/services';

@Injectable()
export class LocalNetworkGuard implements CanActivate {
    private readonly logger = new Logger(LocalNetworkGuard.name);

    constructor(
        private readonly reflector: Reflector,
        private readonly localNetworkService: LocalNetworkService,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        // The restriction only applies to the REST API
        // Non-HTTP contexts (e.g. MQTT/Zigbee controllers) have no client address
        if (context.getType() !== 'http') {
            return true;
        }
        if (!this.isLocalNetworkOnlyEndpoint(context) || !this.localNetworkService.isRestrictionEnabled()) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        if (this.localNetworkService.isLocalRequest(request)) {
            return true;
        }

        // Logged on debug to not flood the logs when the server is being scanned from the internet
        this.logger.debug(`Rejected a request to ${request?.originalUrl} from a non-local address ${request?.ip}`);
        throw new ForbiddenException('This endpoint is only accessible from the local network');
    }

    private isLocalNetworkOnlyEndpoint(context: ExecutionContext): boolean {
        return this.reflector.getAllAndOverride<boolean>(IS_LOCAL_NETWORK_ONLY_KEY, [context.getHandler(), context.getClass()]);
    }
}
