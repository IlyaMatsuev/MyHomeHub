import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from './interfaces';
import { UserResponseDto } from './dto';
import { AuthenticatedUser } from 'auth/interfaces';

describe('UsersController', () => {
    let controller: UsersController;
    let mockUsersService: { findByExternalId: jest.Mock };

    const mockUser = {
        externalId: 'user-external-id',
        email: 'test@example.com',
        role: UserRole.Resident,
    };

    const mockAuthenticatedUser: AuthenticatedUser = {
        userId: 'user-external-id',
        email: 'test@example.com',
        role: UserRole.Resident,
    };

    beforeEach(async () => {
        mockUsersService = {
            findByExternalId: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
            ],
        }).compile();

        controller = module.get<UsersController>(UsersController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('me', () => {
        it('should return the user details for the authenticated user', async () => {
            mockUsersService.findByExternalId.mockResolvedValue(mockUser);

            const result = await controller.me(mockAuthenticatedUser);

            expect(result).toEqual(new UserResponseDto(mockUser));
            expect(mockUsersService.findByExternalId).toHaveBeenCalledWith('user-external-id');
        });

        it('should expose the linked google account details', async () => {
            mockUsersService.findByExternalId.mockResolvedValue({
                ...mockUser,
                password: 'hashed-password',
                googleIdHash: 'google-sub-hash-123',
                googleEmail: 'test@example.com',
            });

            const result = await controller.me(mockAuthenticatedUser);

            expect(result.googleLinked).toBe(true);
            expect(result.googleEmail).toBe('test@example.com');
            expect(result.hasPassword).toBe(true);
        });

        it('should report no linked google account for a user registered with credentials', async () => {
            mockUsersService.findByExternalId.mockResolvedValue({ ...mockUser, password: 'hashed-password' });

            const result = await controller.me(mockAuthenticatedUser);

            expect(result.googleLinked).toBe(false);
            expect(result.googleEmail).toBeUndefined();
            expect(result.hasPassword).toBe(true);
        });

        it('should report no password for a user registered with a google account only', async () => {
            mockUsersService.findByExternalId.mockResolvedValue({ ...mockUser, googleIdHash: 'google-sub-hash-123' });

            const result = await controller.me(mockAuthenticatedUser);

            expect(result.googleLinked).toBe(true);
            expect(result.hasPassword).toBe(false);
        });

        it('should throw NotFoundException when the user does not exist', async () => {
            mockUsersService.findByExternalId.mockRejectedValue(new NotFoundException());

            await expect(controller.me(mockAuthenticatedUser)).rejects.toThrow(NotFoundException);
        });
    });
});
