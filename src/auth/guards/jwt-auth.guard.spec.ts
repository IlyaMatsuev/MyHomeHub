import { ExecutionContext } from '@nestjs/common';
import { AuthConfigService } from 'auth/auth-config.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;
    let mockAuthConfig: { isPublicEndpoint: jest.Mock; isAuthEnabled: jest.Mock };

    const createMockContext = (type = 'http'): ExecutionContext =>
        ({
            getType: jest.fn().mockReturnValue(type),
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({ headers: {} }),
            }),
            getHandler: jest.fn(),
            getClass: jest.fn(),
        }) as unknown as ExecutionContext;

    beforeEach(() => {
        mockAuthConfig = {
            isPublicEndpoint: jest.fn().mockReturnValue(false),
            isAuthEnabled: jest.fn().mockReturnValue(true),
        };
        guard = new JwtAuthGuard(mockAuthConfig as unknown as AuthConfigService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should allow non-http contexts (e.g. MQTT) without delegating to passport', () => {
        const superCanActivate = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate');

        expect(guard.canActivate(createMockContext('rpc'))).toBe(true);
        expect(superCanActivate).not.toHaveBeenCalled();
        expect(mockAuthConfig.isPublicEndpoint).not.toHaveBeenCalled();
    });

    it('should allow public endpoints without delegating to passport', () => {
        mockAuthConfig.isPublicEndpoint.mockReturnValue(true);

        expect(guard.canActivate(createMockContext())).toBe(true);
    });

    it('should allow requests when auth is disabled', () => {
        mockAuthConfig.isAuthEnabled.mockReturnValue(false);

        expect(guard.canActivate(createMockContext())).toBe(true);
    });

    it('should delegate to passport for protected endpoints', () => {
        const superCanActivate = jest
            .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
            .mockReturnValue('passport-result');

        const result = guard.canActivate(createMockContext());

        expect(result).toBe('passport-result');
        expect(superCanActivate).toHaveBeenCalled();
    });
});
