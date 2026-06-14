import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;
    let mockReflector: { getAllAndOverride: jest.Mock };
    let mockConfigService: { get: jest.Mock };

    const createMockContext = (): ExecutionContext =>
        ({
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({ headers: {} }),
            }),
            getHandler: jest.fn(),
            getClass: jest.fn(),
        }) as unknown as ExecutionContext;

    beforeEach(() => {
        mockReflector = { getAllAndOverride: jest.fn() };
        mockConfigService = { get: jest.fn().mockReturnValue('prod') };
        guard = new JwtAuthGuard(mockReflector as unknown as Reflector, mockConfigService as unknown as ConfigService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should allow public endpoints without delegating to passport', () => {
        mockReflector.getAllAndOverride.mockReturnValue(true);

        expect(guard.canActivate(createMockContext())).toBe(true);
    });

    it('should allow requests when local auth bypass is enabled', () => {
        mockReflector.getAllAndOverride.mockReturnValue(false);
        mockConfigService.get.mockImplementation((key: string) => (key === 'NODE_ENV' ? 'local' : 'false'));

        expect(guard.canActivate(createMockContext())).toBe(true);
    });

    it('should delegate to passport for protected endpoints', () => {
        mockReflector.getAllAndOverride.mockReturnValue(false);
        const superCanActivate = jest
            .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
            .mockReturnValue('passport-result');

        const result = guard.canActivate(createMockContext());

        expect(result).toBe('passport-result');
        expect(superCanActivate).toHaveBeenCalled();
    });
});
