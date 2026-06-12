import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from 'users/users.service';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import { RegistrationRequestStatus } from 'users/interfaces';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';

jest.mock('argon2');
jest.mock('speakeasy');

describe('AuthService', () => {
    let service: AuthService;
    let usersService: jest.Mocked<UsersService>;
    let jwtService: jest.Mocked<JwtService>;
    let registrationRequestsService: jest.Mocked<RegistrationRequestsService>;

    const mockUser = {
        _id: 'user-id-123',
        id: 'user-id-123',
        email: 'test@example.com',
        password: 'hashed-password',
    };

    const mockConfig: Record<string, string> = {
        JWT_SECRET: 'test-jwt-secret',
        REGISTRATION_TOTP_SECRET: 'test-totp-secret',
        USER_PASSWORD_SECRET: 'test-password-secret',
        USER_PASSWORD_SALT: 'test-salt',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UsersService,
                    useValue: {
                        findByEmail: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        signAsync: jest.fn(),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => mockConfig[key]),
                    },
                },
                {
                    provide: RegistrationRequestsService,
                    useValue: {
                        findByEmail: jest.fn(),
                        createAutoApprovedRequest: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        usersService = module.get(UsersService);
        jwtService = module.get(JwtService);
        registrationRequestsService = module.get(RegistrationRequestsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('should return access token when credentials are valid', async () => {
            usersService.findByEmail.mockResolvedValue(mockUser as never);
            (argon2.verify as jest.Mock).mockResolvedValue(true);
            jwtService.signAsync.mockResolvedValue('jwt-token');

            const result = await service.login('test@example.com', 'password');

            expect(result).toEqual({ accessToken: 'jwt-token' });
            expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(argon2.verify).toHaveBeenCalledWith('hashed-password', 'password', {
                secret: Buffer.from('test-password-secret'),
            });
            expect(jwtService.signAsync).toHaveBeenCalledWith(
                { sub: 'user-id-123', email: 'test@example.com' },
                { secret: 'test-jwt-secret' },
            );
        });

        it('should throw UnauthorizedException when user not found', async () => {
            usersService.findByEmail.mockResolvedValue(undefined as never);

            await expect(service.login('nonexistent@example.com', 'password')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when password is invalid', async () => {
            usersService.findByEmail.mockResolvedValue(mockUser as never);
            (argon2.verify as jest.Mock).mockResolvedValue(false);

            await expect(service.login('test@example.com', 'wrong-password')).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('register', () => {
        it('should create new user when TOTP is valid and create auto-approved request', async () => {
            const newUser = { ...mockUser, _id: 'new-user-id' };
            (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
            (argon2.hash as jest.Mock).mockResolvedValue('new-hashed-password');
            usersService.create.mockResolvedValue(newUser as never);
            registrationRequestsService.createAutoApprovedRequest.mockResolvedValue({} as never);

            const result = await service.register('new@example.com', 'password', '123456');

            expect(result).toEqual({ email: 'test@example.com' });
            expect(speakeasy.totp.verify).toHaveBeenCalledWith({
                secret: 'test-totp-secret',
                encoding: 'base32',
                token: '123456',
            });
            expect(usersService.create).toHaveBeenCalledWith('new@example.com', 'new-hashed-password');
            expect(registrationRequestsService.createAutoApprovedRequest).toHaveBeenCalledWith('new@example.com');
        });

        it('should throw UnauthorizedException when TOTP is invalid', async () => {
            (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

            await expect(service.register('new@example.com', 'password', 'invalid-totp')).rejects.toThrow(UnauthorizedException);
            expect(usersService.create).not.toHaveBeenCalled();
        });

        it('should create user when registration request is approved and no TOTP provided', async () => {
            const newUser = { ...mockUser, _id: 'new-user-id', email: 'approved@example.com' };
            const approvedRequest = { status: RegistrationRequestStatus.APPROVED };
            registrationRequestsService.findByEmail.mockResolvedValue(approvedRequest as never);
            (argon2.hash as jest.Mock).mockResolvedValue('new-hashed-password');
            usersService.create.mockResolvedValue(newUser as never);

            const result = await service.register('approved@example.com', 'password');

            expect(result).toEqual({ email: 'approved@example.com' });
            expect(usersService.create).toHaveBeenCalledWith('approved@example.com', 'new-hashed-password');
        });

        it('should throw BadRequestException when no TOTP and no registration request exists', async () => {
            registrationRequestsService.findByEmail.mockResolvedValue(null);

            await expect(service.register('new@example.com', 'password')).rejects.toThrow(BadRequestException);
            await expect(service.register('new@example.com', 'password')).rejects.toThrow(
                'No registration request found for this email. Please submit a registration request first.',
            );
            expect(usersService.create).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException when registration request is pending', async () => {
            const pendingRequest = { status: RegistrationRequestStatus.PENDING };
            registrationRequestsService.findByEmail.mockResolvedValue(pendingRequest as never);

            await expect(service.register('pending@example.com', 'password')).rejects.toThrow(BadRequestException);
            await expect(service.register('pending@example.com', 'password')).rejects.toThrow(
                'Your registration request has not been reviewed yet. Please wait for admin approval.',
            );
            expect(usersService.create).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException when registration request is rejected', async () => {
            const rejectedRequest = { status: RegistrationRequestStatus.REJECTED };
            registrationRequestsService.findByEmail.mockResolvedValue(rejectedRequest as never);

            await expect(service.register('rejected@example.com', 'password')).rejects.toThrow(BadRequestException);
            await expect(service.register('rejected@example.com', 'password')).rejects.toThrow(
                'Your registration request has been rejected.',
            );
            expect(usersService.create).not.toHaveBeenCalled();
        });
    });

    describe('verifyTotp', () => {
        it('should return true when TOTP is valid', () => {
            (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

            expect(service.verifyTotp('123456')).toBe(true);
            expect(speakeasy.totp.verify).toHaveBeenCalledWith({
                secret: 'test-totp-secret',
                encoding: 'base32',
                token: '123456',
            });
        });

        it('should return false when TOTP is invalid', () => {
            (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

            expect(service.verifyTotp('invalid')).toBe(false);
        });
    });

    describe('generateUserPasswordHash', () => {
        it('should hash password with argon2', async () => {
            (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');

            const result = await service.generateUserPasswordHash('password');

            expect(result).toBe('hashed-password');
            expect(argon2.hash).toHaveBeenCalledWith('password', {
                secret: Buffer.from('test-password-secret'),
                salt: Buffer.from('test-salt'),
            });
        });
    });

    describe('verifyUserPasswordHash', () => {
        it('should verify password hash with argon2', async () => {
            (argon2.verify as jest.Mock).mockResolvedValue(true);

            const result = await service.verifyUserPasswordHash('hashed-password', 'password');

            expect(result).toBe(true);
            expect(argon2.verify).toHaveBeenCalledWith('hashed-password', 'password', {
                secret: Buffer.from('test-password-secret'),
            });
        });

        it('should return false when password does not match', async () => {
            (argon2.verify as jest.Mock).mockResolvedValue(false);

            const result = await service.verifyUserPasswordHash('hashed-password', 'wrong-password');

            expect(result).toBe(false);
        });
    });
});
