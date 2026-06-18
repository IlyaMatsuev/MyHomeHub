import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthConfigService } from 'auth/auth-config.service';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from 'auth/decorators';
import { UserRole } from 'users/interfaces';

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let mockReflector: { getAllAndOverride: jest.Mock };
    let mockAuthConfig: { isPublicEndpoint: jest.Mock; isAuthEnabled: jest.Mock };

    const createMockContext = (user?: { role: UserRole }): ExecutionContext =>
        ({
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({ user }),
            }),
            getHandler: jest.fn(),
            getClass: jest.fn(),
        }) as unknown as ExecutionContext;

    beforeEach(() => {
        mockReflector = { getAllAndOverride: jest.fn() };
        mockAuthConfig = {
            isPublicEndpoint: jest.fn().mockReturnValue(false),
            isAuthEnabled: jest.fn().mockReturnValue(true),
        };
        guard = new RolesGuard(mockReflector as unknown as Reflector, mockAuthConfig as unknown as AuthConfigService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should allow public endpoints', () => {
        mockAuthConfig.isPublicEndpoint.mockReturnValue(true);

        expect(guard.canActivate(createMockContext())).toBe(true);
    });

    it('should allow when auth is disabled', () => {
        mockAuthConfig.isAuthEnabled.mockReturnValue(false);

        expect(guard.canActivate(createMockContext())).toBe(true);
    });

    it('should allow when no roles are required', () => {
        mockReflector.getAllAndOverride.mockImplementation((key: string) => (key === ROLES_KEY ? undefined : false));

        expect(guard.canActivate(createMockContext({ role: UserRole.Guest }))).toBe(true);
    });

    it('should always allow admins', () => {
        mockReflector.getAllAndOverride.mockImplementation((key: string) => (key === ROLES_KEY ? [UserRole.Resident] : false));

        expect(guard.canActivate(createMockContext({ role: UserRole.Admin }))).toBe(true);
    });

    it('should allow when the user role is in the required roles', () => {
        mockReflector.getAllAndOverride.mockImplementation((key: string) => (key === ROLES_KEY ? [UserRole.Resident] : false));

        expect(guard.canActivate(createMockContext({ role: UserRole.Resident }))).toBe(true);
    });

    it('should throw ForbiddenException when the user role is not allowed', () => {
        mockReflector.getAllAndOverride.mockImplementation((key: string) => (key === ROLES_KEY ? [UserRole.Resident] : false));

        expect(() => guard.canActivate(createMockContext({ role: UserRole.Guest }))).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when there is no authenticated user', () => {
        mockReflector.getAllAndOverride.mockImplementation((key: string) => (key === ROLES_KEY ? [UserRole.Resident] : false));

        expect(() => guard.canActivate(createMockContext())).toThrow(ForbiddenException);
    });
});
