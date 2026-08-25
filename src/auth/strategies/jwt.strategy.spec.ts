import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from 'users/users.service';
import { AuthConfigService } from 'auth/auth-config.service';
import { UserRole } from 'users/interfaces';

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;
    let mockUsersService: { findByExternalId: jest.Mock };

    const mockUser = {
        externalId: 'user-external-id',
        email: 'test@example.com',
        role: UserRole.Resident,
    };

    beforeEach(() => {
        const authConfig = { getJwtSecret: jest.fn().mockReturnValue('test-jwt-secret') } as unknown as AuthConfigService;
        mockUsersService = { findByExternalId: jest.fn() };
        strategy = new JwtStrategy(authConfig, mockUsersService as unknown as UsersService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('validate', () => {
        it('should load the user by externalId and return identity from the database', async () => {
            mockUsersService.findByExternalId.mockResolvedValue(mockUser);

            const result = await strategy.validate({ sub: 'user-external-id' });

            expect(mockUsersService.findByExternalId).toHaveBeenCalledWith('user-external-id', { strict: false });
            expect(result).toEqual({ userId: 'user-external-id', email: 'test@example.com', role: UserRole.Resident });
        });

        it('should throw UnauthorizedException when the user is not found', async () => {
            mockUsersService.findByExternalId.mockResolvedValue(null);

            await expect(strategy.validate({ sub: 'unknown-external-id' })).rejects.toThrow(UnauthorizedException);
        });
    });
});
