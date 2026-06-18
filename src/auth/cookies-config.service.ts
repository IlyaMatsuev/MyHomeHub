import { Injectable } from '@nestjs/common';
import { CookieOptions } from 'express';
import { AuthConfigService } from 'auth/auth-config.service';
import { seconds } from '@nestjs/throttler';

@Injectable()
export class CookiesConfigService {
    private readonly configs: Record<string, CookieOptions>;
    private readonly defaultConfig: CookieOptions;

    constructor(private readonly authConfig: AuthConfigService) {
        this.defaultConfig = {
            httpOnly: true,
            secure: this.authConfig.isProdEnv(),
            sameSite: 'lax',
        };
        this.configs = {
            accessToken: {
                ...this.defaultConfig,
                maxAge: seconds(this.authConfig.getJwtExpTimeout()),
            },
            refreshToken: {
                ...this.defaultConfig,
                path: '/auth/login/refresh',
                maxAge: seconds(this.authConfig.getJwtRefreshExpTimeout()),
            },
        };
    }

    get(name: string): CookieOptions {
        return this.configs[name] ?? this.defaultConfig;
    }
}
