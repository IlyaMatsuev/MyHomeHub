import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'auth/decorators';

@Injectable()
export class AuthConfigService {
    constructor(
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
    ) {}

    isPublicEndpoint(context: ExecutionContext): boolean {
        return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
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

    getJwtRestoreSecret(): string {
        return this.configService.get<string>('JWT_RESTORE_SECRET');
    }

    getJwtRestoreExpTimeout(): number {
        return this.getNumberConfig('JWT_RESTORE_EXPIRATION_TIMEOUT');
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

    private getNumberConfig(name: string): number | undefined {
        const value = +this.configService.get<string>(name);
        return Number.isNaN(value) ? undefined : value;
    }
}
