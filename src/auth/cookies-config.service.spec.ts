import { Test, TestingModule } from '@nestjs/testing';
import { AuthConfigService } from 'auth/auth-config.service';
import { CookiesConfigService } from './cookies-config.service';

interface AuthConfigOverrides {
    isProdEnv?: boolean;
    jwtExpTimeout?: number;
    jwtRefreshExpTimeout?: number;
}

describe('CookiesConfigService', () => {
    let service: CookiesConfigService;

    const buildService = async (overrides: AuthConfigOverrides = {}): Promise<CookiesConfigService> => {
        const authConfig = {
            isProdEnv: jest.fn().mockReturnValue(overrides.isProdEnv ?? false),
            getJwtExpTimeout: jest.fn().mockReturnValue(overrides.jwtExpTimeout),
            getJwtRefreshExpTimeout: jest.fn().mockReturnValue(overrides.jwtRefreshExpTimeout),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CookiesConfigService,
                {
                    provide: AuthConfigService,
                    useValue: authConfig,
                },
            ],
        }).compile();

        return module.get<CookiesConfigService>(CookiesConfigService);
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('get', () => {
        beforeEach(async () => {
            service = await buildService({ jwtExpTimeout: 3600, jwtRefreshExpTimeout: 86400 });
        });

        it('should return accessToken options with maxAge in milliseconds', () => {
            const options = service.get('accessToken');

            expect(options).toEqual({
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                maxAge: 3600 * 1000,
            });
        });

        it('should return refreshToken options with a scoped path and maxAge in milliseconds', () => {
            const options = service.get('refreshToken');

            expect(options).toEqual({
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                path: '/auth/login/refresh',
                maxAge: 86400 * 1000,
            });
        });

        it('should return default options for unknown cookie names', () => {
            const options = service.get('unknownCookie');

            expect(options).toEqual({
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
            });
        });
    });

    describe('production environment', () => {
        beforeEach(async () => {
            service = await buildService({ isProdEnv: true, jwtExpTimeout: 3600, jwtRefreshExpTimeout: 86400 });
        });

        it('should set secure: true on every cookie config', () => {
            expect(service.get('accessToken').secure).toBe(true);
            expect(service.get('refreshToken').secure).toBe(true);
            expect(service.get('unknownCookie').secure).toBe(true);
        });
    });

    describe('missing token timeout config', () => {
        beforeEach(async () => {
            service = await buildService();
        });

        it('should not throw at construction time', () => {
            expect(service).toBeDefined();
        });

        it('should leave maxAge as NaN when the underlying timeout is unset', () => {
            expect(service.get('accessToken').maxAge).toBeNaN();
            expect(service.get('refreshToken').maxAge).toBeNaN();
        });
    });
});
