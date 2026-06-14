import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from 'auth/decorators';
import { UserRole } from 'users/interfaces';

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let mockReflector: { getAllAndOverride: jest.Mock };
    let mockConfigService: { get: jest.Mock };

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
        mockConfigService = { get: jest.fn().mockReturnValue('prod') };
        guard = new RolesGuard(mockReflector as unknown as Reflector, mockConfigService as unknown as ConfigService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should allow public endpoints', () => {
        mockReflector.getAllAndOverride.mockImplementation((key: string) => key === 'isPublic');

        expect(guard.canActivate(createMockContext())).toBe(true);
    });

    it('should allow when local auth bypass is enabled', () => {
        mockReflector.getAllAndOverride.mockReturnValue(false);
        mockConfigService.get.mockImplementation((key: string) => (key === 'NODE_ENV' ? 'local' : 'false'));

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
