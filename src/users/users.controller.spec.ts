import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from './interfaces';
import { UserResponseDto } from './dto';
import { AuthenticatedUser } from 'auth/interfaces';

describe('UsersController', () => {
    let controller: UsersController;
    let mockUsersService: { getUserByExternalId: jest.Mock };

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
            getUserByExternalId: jest.fn(),
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
            mockUsersService.getUserByExternalId.mockResolvedValue(mockUser);

            const result = await controller.me(mockAuthenticatedUser);

            expect(result).toEqual(new UserResponseDto(mockUser));
            expect(mockUsersService.getUserByExternalId).toHaveBeenCalledWith('user-external-id');
        });

        it('should throw NotFoundException when the user does not exist', async () => {
            mockUsersService.getUserByExternalId.mockRejectedValue(new NotFoundException());

            await expect(controller.me(mockAuthenticatedUser)).rejects.toThrow(NotFoundException);
        });
    });
});
