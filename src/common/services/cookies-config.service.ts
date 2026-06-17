import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions } from 'express';
import { seconds } from '@nestjs/throttler';

@Injectable()
export class CookiesConfigService {
    private readonly configs: Record<string, CookieOptions>;
    private readonly defaultConfig: CookieOptions;

    constructor(private readonly configService: ConfigService) {
        const isProd = this.configService.get<string>('NODE_ENV') === 'production';
        this.defaultConfig = {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
        };
        this.configs = {
            accessToken: {
                ...this.defaultConfig,
                maxAge: seconds(this.getNumberConfig('JWT_EXPIRATION_TIMEOUT')),
            },
            refreshToken: {
                ...this.defaultConfig,
                path: '/auth/login/refresh',
                maxAge: seconds(this.getNumberConfig('JWT_REFRESH_EXPIRATION_TIMEOUT')),
            },
        };
    }

    get(name: string): CookieOptions {
        return this.configs[name] ?? this.defaultConfig;
    }

    private getNumberConfig(name: string): number | undefined {
        const value = +this.configService.get(name);
        return Number.isNaN(value) ? undefined : value;
    }
}
