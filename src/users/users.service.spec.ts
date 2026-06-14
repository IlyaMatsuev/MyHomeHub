import { Test, TestingModule } from '@nestjs/testing';
import { FieldValidationException } from 'common/exceptions';
import { UsersService } from './users.service';
import { USER_MODEL_PROVIDER_NAME } from './users.constants';
import { User, UserRole } from './interfaces';

describe('UsersService', () => {
    let service: UsersService;
    let mockUserModel: {
        findOne: jest.Mock;
        new: jest.Mock;
    };

    const mockUser: Partial<User> = {
        _id: 'user-id-123',
        id: 'user-id-123',
        email: 'test@example.com',
        password: 'hashed-password',
        role: UserRole.Guest,
    };

    beforeEach(async () => {
        const MockUserModel = jest.fn().mockImplementation(function (data) {
            return {
                ...data,
                save: jest.fn().mockResolvedValue({ ...mockUser, ...data }),
            };
        }) as jest.Mock & {
            findOne: jest.Mock;
        };
        MockUserModel.findOne = jest.fn();

        mockUserModel = MockUserModel as unknown as typeof mockUserModel;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: USER_MODEL_PROVIDER_NAME,
                    useValue: mockUserModel,
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('findByEmail', () => {
        it('should return user when found', async () => {
            mockUserModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockUser),
            });

            const result = await service.findByEmail('test@example.com');

            expect(result).toEqual(mockUser);
            expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
        });

        it('should return undefined when user not found', async () => {
            mockUserModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const result = await service.findByEmail('nonexistent@example.com');

            expect(result).toBeNull();
        });
    });

    describe('create', () => {
        it('should create a new user when email does not exist', async () => {
            mockUserModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const result = await service.create('new@example.com', 'hashed-password', UserRole.Resident);

            expect(result.email).toBe('new@example.com');
            expect(result.password).toBe('hashed-password');
            expect(result.role).toBe(UserRole.Resident);
        });

        it('should throw FieldValidationException when user with email already exists', async () => {
            mockUserModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockUser),
            });

            await expect(service.create('test@example.com', 'hashed-password', UserRole.Guest)).rejects.toThrow(FieldValidationException);
            await expect(service.create('test@example.com', 'hashed-password', UserRole.Guest)).rejects.toMatchObject({
                response: {
                    messages: ['User with the provided email already exists'],
                    details: { errors: [{ message: 'User with the provided email already exists', path: 'email' }] },
                },
            });
        });
    });
});
