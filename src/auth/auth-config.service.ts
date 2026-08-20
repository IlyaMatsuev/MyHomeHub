import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'auth/decorators';
import { PublicOptions } from 'auth/interfaces';

@Injectable()
export class AuthConfigService {
    constructor(
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
    ) {}

    isPublicEndpoint(context: ExecutionContext): boolean {
        return !!this.getPublicOptions(context);
    }

    isLocalNetworkOnlyEndpoint(context: ExecutionContext): boolean {
        return !!this.getPublicOptions(context)?.localOnly;
    }

    isAuthEnabled(): boolean {
        const isLocalAuthEnabled = this.configService.get<string>('ENABLE_LOCAL_AUTH') === 'true';
        return this.isProdEnv() || isLocalAuthEnabled;
    }

    isProdEnv(): boolean {
        return this.configService.get<string>('NODE_ENV') === 'prod';
    }

    getJwtSecret(): string {
        return this.configService.get<string>('JWT_SECRET');
    }

    getJwtExpTimeout(): number {
        return this.getNumberConfig('JWT_EXPIRATION_TIMEOUT');
    }

    getJwtRefreshSecret(): string {
        return this.configService.get<string>('JWT_REFRESH_SECRET');
    }

    getJwtRefreshExpTimeout(): number {
        return this.getNumberConfig('JWT_REFRESH_EXPIRATION_TIMEOUT');
    }

    getPasswordResetTokenTtlSec(): number {
        return this.getNumberConfig('PASSWORD_RESET_TOKEN_TTL_SEC');
    }

    getRedisKeyPrefix(): string {
        return this.configService.get<string>('REDIS_KEY_PREFIX');
    }

    getRedisHost(): string {
        return this.configService.get<string>('REDIS_DOMAIN');
    }

    getRedisPort(): number {
        return this.getNumberConfig('REDIS_PORT');
    }

    getTotpSecret(): string {
        return this.configService.get<string>('REGISTRATION_TOTP_SECRET');
    }

    getUserPasswordSecret(): string {
        return this.configService.get<string>('USER_PASSWORD_SECRET');
    }

    getUserPasswordSalt(): string {
        return this.configService.get<string>('USER_PASSWORD_SALT');
    }

    private getPublicOptions(context: ExecutionContext): PublicOptions | undefined {
        return this.reflector.getAllAndOverride<PublicOptions>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    }

    private getNumberConfig(name: string): number | undefined {
        const value = +this.configService.get<string>(name);
        return Number.isNaN(value) ? undefined : value;
    }
}
