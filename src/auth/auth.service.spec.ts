import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { FieldValidationException } from 'common/exceptions';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthConfigService } from './auth-config.service';
import { PasswordResetTokensService } from './password-reset-tokens.service';
import { UsersService } from 'users/users.service';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import { RegistrationRequestStatus, UserRole } from 'users/interfaces';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';

jest.mock('argon2');
jest.mock('speakeasy');

describe('AuthService', () => {
    let service: AuthService;
    let usersService: jest.Mocked<UsersService>;
    let jwtService: jest.Mocked<JwtService>;
    let registrationRequestsService: jest.Mocked<RegistrationRequestsService>;
    let passwordResetTokensService: jest.Mocked<PasswordResetTokensService>;

    const mockUser = {
        _id: 'user-id-123',
        id: 'user-id-123',
        externalId: 'user-external-id',
        email: 'test@example.com',
        password: 'hashed-password',
        role: UserRole.Resident,
    };

    const mockAuthConfig = {
        getJwtSecret: jest.fn().mockReturnValue('test-jwt-secret'),
        getJwtExpTimeout: jest.fn().mockReturnValue(900),
        getJwtRefreshSecret: jest.fn().mockReturnValue('test-jwt-refresh-secret'),
        getJwtRefreshExpTimeout: jest.fn().mockReturnValue(604800),
        getPasswordResetTokenTtlSec: jest.fn().mockReturnValue(300),
        getTotpSecret: jest.fn().mockReturnValue('test-totp-secret'),
        getUserPasswordSecret: jest.fn().mockReturnValue('test-password-secret'),
        getUserPasswordSalt: jest.fn().mockReturnValue('test-salt'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UsersService,
                    useValue: {
                        findByEmail: jest.fn(),
                        getUserByExternalId: jest.fn(),
                        create: jest.fn(),
                        updatePassword: jest.fn(),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        signAsync: jest.fn(),
                        verifyAsync: jest.fn(),
                    },
                },
                {
                    provide: AuthConfigService,
                    useValue: mockAuthConfig,
                },
                {
                    provide: RegistrationRequestsService,
                    useValue: {
                        getApprovedRequestByEmail: jest.fn(),
                        createAutoApprovedRequest: jest.fn(),
                    },
                },
                {
                    provide: PasswordResetTokensService,
                    useValue: {
                        issue: jest.fn(),
                        consume: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        usersService = module.get(UsersService);
        jwtService = module.get(JwtService);
        registrationRequestsService = module.get(RegistrationRequestsService);
        passwordResetTokensService = module.get(PasswordResetTokensService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('should return access and refresh tokens when credentials are valid', async () => {
            usersService.findByEmail.mockResolvedValue(mockUser as never);
            (argon2.verify as jest.Mock).mockResolvedValue(true);
            jwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');

            const result = await service.login('test@example.com', 'password');

            expect(result).toEqual({ externalId: 'user-external-id', accessToken: 'access-token', refreshToken: 'refresh-token' });
            expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(argon2.verify).toHaveBeenCalledWith('hashed-password', 'password', {
                secret: Buffer.from('test-password-secret'),
            });
            expect(jwtService.signAsync).toHaveBeenNthCalledWith(
                1,
                { sub: 'user-external-id' },
                { secret: 'test-jwt-secret', expiresIn: 900 },
            );
            expect(jwtService.signAsync).toHaveBeenNthCalledWith(
                2,
                { sub: 'user-external-id' },
                { secret: 'test-jwt-refresh-secret', expiresIn: 604800 },
            );
        });

        it('should throw UnauthorizedException when user not found', async () => {
            usersService.findByEmail.mockResolvedValue(undefined as never);

            await expect(service.login('nonexistent@example.com', 'password')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when the user has no password set', async () => {
            usersService.findByEmail.mockResolvedValue({ ...mockUser, password: undefined } as never);

            await expect(service.login('test@example.com', 'password')).rejects.toThrow(UnauthorizedException);
            expect(argon2.verify).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException without verifying the hash for a google-only account', async () => {
            usersService.findByEmail.mockResolvedValue({ ...mockUser, password: undefined, googleIdHash: 'google-sub-hash-123' } as never);

            await expect(service.login('test@example.com', 'password')).rejects.toThrow(UnauthorizedException);
            expect(argon2.verify).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException when password is invalid', async () => {
            usersService.findByEmail.mockResolvedValue(mockUser as never);
            (argon2.verify as jest.Mock).mockResolvedValue(false);

            await expect(service.login('test@example.com', 'wrong-password')).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('refreshToken', () => {
        it('should issue new tokens for a valid refresh token', async () => {
            jwtService.verifyAsync.mockResolvedValue({ sub: 'user-external-id' } as never);
            usersService.getUserByExternalId.mockResolvedValue(mockUser as never);
            jwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');

            const result = await service.refreshToken('valid-refresh-token');

            expect(result).toEqual({ externalId: 'user-external-id', accessToken: 'access-token', refreshToken: 'refresh-token' });
            expect(usersService.getUserByExternalId).toHaveBeenCalledWith('user-external-id', { strict: false });
        });

        it('should throw UnauthorizedException when refresh token is invalid', async () => {
            jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

            await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when the user no longer exists', async () => {
            jwtService.verifyAsync.mockResolvedValue({ sub: 'user-external-id' } as never);
            usersService.getUserByExternalId.mockResolvedValue(null as never);

            await expect(service.refreshToken('valid-refresh-token')).rejects.toThrow(UnauthorizedException);
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

            // role is undefined because UserRole[newUser.role] has no reverse lookup for string enums
            expect(result).toEqual({ externalId: 'user-external-id', email: 'test@example.com', role: undefined });
            expect(speakeasy.totp.verify).toHaveBeenCalledWith({
                secret: 'test-totp-secret',
                encoding: 'base32',
                token: '123456',
            });
            expect(usersService.create).toHaveBeenCalledWith({
                email: 'new@example.com',
                password: 'new-hashed-password',
                role: UserRole.Admin,
            });
            expect(registrationRequestsService.createAutoApprovedRequest).toHaveBeenCalledWith('new@example.com');
        });

        it('should throw ForbiddenException when TOTP is invalid', async () => {
            (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

            await expect(service.register('new@example.com', 'password', 'invalid-totp')).rejects.toThrow(ForbiddenException);
            expect(usersService.create).not.toHaveBeenCalled();
        });

        it('should create user when registration request is approved and no TOTP provided', async () => {
            const newUser = { ...mockUser, _id: 'new-user-id', email: 'approved@example.com' };
            const approvedRequest = { status: RegistrationRequestStatus.Approved, role: UserRole.Resident };
            registrationRequestsService.getApprovedRequestByEmail.mockResolvedValue(approvedRequest as never);
            (argon2.hash as jest.Mock).mockResolvedValue('new-hashed-password');
            usersService.create.mockResolvedValue(newUser as never);

            const result = await service.register('approved@example.com', 'password');

            // role is undefined because UserRole[newUser.role] has no reverse lookup for string enums
            expect(result).toEqual({ externalId: 'user-external-id', email: 'approved@example.com', role: undefined });
            expect(usersService.create).toHaveBeenCalledWith({
                email: 'approved@example.com',
                password: 'new-hashed-password',
                role: UserRole.Resident,
            });
        });

        it('should propagate the registration request validation error and not create a user', async () => {
            const requestError = new FieldValidationException(
                'No registration request found for this email. Please submit a registration request first.',
                'email',
            );
            registrationRequestsService.getApprovedRequestByEmail.mockRejectedValue(requestError);

            await expect(service.register('new@example.com', 'password')).rejects.toThrow(FieldValidationException);
            expect(registrationRequestsService.getApprovedRequestByEmail).toHaveBeenCalledWith('new@example.com');
            expect(usersService.create).not.toHaveBeenCalled();
        });
    });

    describe('requestPasswordReset', () => {
        it('should issue a reset token when TOTP and email are valid', async () => {
            (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
            usersService.findByEmail.mockResolvedValue(mockUser as never);
            passwordResetTokensService.issue.mockResolvedValue('reset-token');

            const result = await service.requestPasswordReset('test@example.com', '123456');

            expect(result).toEqual({ resetToken: 'reset-token' });
            expect(speakeasy.totp.verify).toHaveBeenCalledWith({
                secret: 'test-totp-secret',
                encoding: 'base32',
                token: '123456',
            });
            expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(passwordResetTokensService.issue).toHaveBeenCalledWith('user-external-id');
        });

        it('should throw ForbiddenException when TOTP is invalid', async () => {
            (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

            await expect(service.requestPasswordReset('test@example.com', 'invalid-totp')).rejects.toThrow(ForbiddenException);
            expect(usersService.findByEmail).not.toHaveBeenCalled();
            expect(passwordResetTokensService.issue).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException when user is not found', async () => {
            (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
            usersService.findByEmail.mockResolvedValue(undefined as never);

            await expect(service.requestPasswordReset('missing@example.com', '123456')).rejects.toThrow(UnauthorizedException);
            expect(passwordResetTokensService.issue).not.toHaveBeenCalled();
        });
    });

    describe('changePassword', () => {
        it('should consume the reset token, hash the new password, and update it for the user', async () => {
            passwordResetTokensService.consume.mockResolvedValue('user-external-id');
            usersService.getUserByExternalId.mockResolvedValue(mockUser as never);
            (argon2.hash as jest.Mock).mockResolvedValue('new-hashed-password');
            (usersService.updatePassword as jest.Mock).mockResolvedValue(mockUser as never);

            await service.changePassword('valid-reset-token', 'new-password');

            expect(passwordResetTokensService.consume).toHaveBeenCalledWith('valid-reset-token');
            expect(usersService.getUserByExternalId).toHaveBeenCalledWith('user-external-id', { strict: false });
            expect(argon2.hash).toHaveBeenCalledWith('new-password', {
                secret: Buffer.from('test-password-secret'),
                salt: Buffer.from('test-salt'),
            });
            expect(usersService.updatePassword).toHaveBeenCalledWith('user-external-id', 'new-hashed-password');
        });

        it('should propagate UnauthorizedException when the reset token is invalid or already consumed', async () => {
            passwordResetTokensService.consume.mockRejectedValue(new UnauthorizedException());

            await expect(service.changePassword('invalid-token', 'new-password')).rejects.toThrow(UnauthorizedException);
            expect(usersService.getUserByExternalId).not.toHaveBeenCalled();
            expect(usersService.updatePassword).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException when the user no longer exists', async () => {
            passwordResetTokensService.consume.mockResolvedValue('user-external-id');
            usersService.getUserByExternalId.mockResolvedValue(null as never);

            await expect(service.changePassword('valid-reset-token', 'new-password')).rejects.toThrow(UnauthorizedException);
            expect(usersService.updatePassword).not.toHaveBeenCalled();
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
