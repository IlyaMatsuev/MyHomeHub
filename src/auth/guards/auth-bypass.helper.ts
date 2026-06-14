import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from 'auth/decorators';

export function isPublicEndpoint(reflector: Reflector, context: ExecutionContext): boolean {
    return reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
}

export function isLocalAuthBypass(configService: ConfigService): boolean {
    const isLocalEnvironment = configService.get<string>('NODE_ENV') === 'local';
    const isLocalAuthEnabled = configService.get<string>('ENABLE_LOCAL_AUTH') === 'true';
    return isLocalEnvironment && !isLocalAuthEnabled;
}
