import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';
import { IS_PUBLIC_KEY } from './decorators';

describe('AuthGuard', () => {
    let guard: AuthGuard;
    let mockJwtService: { verifyAsync: jest.Mock };
    let mockReflector: { getAllAndOverride: jest.Mock };
    let mockConfigService: { get: jest.Mock };

    const createMockExecutionContext = (headers: Record<string, string> = {}): ExecutionContext => {
        const mockRequest = {
            headers,
        };

        return {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue(mockRequest),
            }),
            getHandler: jest.fn(),
            getClass: jest.fn(),
        } as unknown as ExecutionContext;
    };

    beforeEach(async () => {
        mockJwtService = { verifyAsync: jest.fn() };
        mockReflector = { getAllAndOverride: jest.fn() };
        mockConfigService = {
            get: jest.fn().mockReturnValue('test-jwt-secret'),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthGuard,
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
                {
                    provide: Reflector,
                    useValue: mockReflector,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        guard = module.get<AuthGuard>(AuthGuard);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('canActivate', () => {
        it('should return true for public endpoints', async () => {
            mockReflector.getAllAndOverride.mockReturnValue(true);

            const context = createMockExecutionContext();
            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        });

        it('should throw UnauthorizedException when no token is provided', async () => {
            mockReflector.getAllAndOverride.mockReturnValue(false);

            const context = createMockExecutionContext({});

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when token type is not Bearer', async () => {
            mockReflector.getAllAndOverride.mockReturnValue(false);

            const context = createMockExecutionContext({
                authorization: 'Basic some-token',
            });

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });

        it('should verify token and set user on request when valid', async () => {
            mockReflector.getAllAndOverride.mockReturnValue(false);
            const decodedToken = { sub: 'user-id', email: 'test@example.com' };
            mockJwtService.verifyAsync.mockResolvedValue(decodedToken);

            const context = createMockExecutionContext({
                authorization: 'Bearer valid-token',
            });

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', { secret: 'test-jwt-secret' });

            const request = context.switchToHttp().getRequest();
            expect(request['user']).toEqual(decodedToken);
        });

        it('should throw UnauthorizedException when token verification fails', async () => {
            mockReflector.getAllAndOverride.mockReturnValue(false);
            mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

            const context = createMockExecutionContext({
                authorization: 'Bearer invalid-token',
            });

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when token is expired', async () => {
            mockReflector.getAllAndOverride.mockReturnValue(false);
            mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

            const context = createMockExecutionContext({
                authorization: 'Bearer expired-token',
            });

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        });
    });
});
