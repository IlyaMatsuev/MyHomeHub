import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CookiesConfigService } from './cookies-config.service';

describe('CookiesConfigService', () => {
    let service: CookiesConfigService;
    let mockConfigService: { get: jest.Mock };

    const buildService = async (env: Record<string, string | undefined>): Promise<CookiesConfigService> => {
        mockConfigService = {
            get: jest.fn((key: string) => env[key]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CookiesConfigService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
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
            service = await buildService({
                NODE_ENV: 'development',
                JWT_EXPIRATION_TIMEOUT: '3600',
                JWT_REFRESH_EXPIRATION_TIMEOUT: '86400',
            });
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
            service = await buildService({
                NODE_ENV: 'production',
                JWT_EXPIRATION_TIMEOUT: '3600',
                JWT_REFRESH_EXPIRATION_TIMEOUT: '86400',
            });
        });

        it('should set secure: true on every cookie config', () => {
            expect(service.get('accessToken').secure).toBe(true);
            expect(service.get('refreshToken').secure).toBe(true);
            expect(service.get('unknownCookie').secure).toBe(true);
        });
    });

    describe('missing token timeout env vars', () => {
        beforeEach(async () => {
            service = await buildService({ NODE_ENV: 'development' });
        });

        it('should not throw at construction time', () => {
            expect(service).toBeDefined();
        });

        it('should leave maxAge as NaN when the underlying env var is missing', () => {
            expect(service.get('accessToken').maxAge).toBeNaN();
            expect(service.get('refreshToken').maxAge).toBeNaN();
        });
    });
});
