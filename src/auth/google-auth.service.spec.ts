import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FieldConflictException, FieldValidationException } from 'common/exceptions';
import { UsersService } from 'users/users.service';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import { RegistrationRequestStatus, UserRole } from 'users/interfaces';
import { GoogleAuthService } from './google-auth.service';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { AuthService } from './auth.service';

describe('GoogleAuthService', () => {
    let service: GoogleAuthService;
    let authService: jest.Mocked<AuthService>;
    let usersService: jest.Mocked<UsersService>;
    let registrationRequestsService: jest.Mocked<RegistrationRequestsService>;
    let googleTokenVerifier: jest.Mocked<GoogleTokenVerifierService>;

    const mockProfile = { googleIdHash: 'google-sub-hash-123', email: 'test@example.com', name: 'Test User' };

    const mockUser = {
        externalId: 'user-external-id',
        email: 'test@example.com',
        password: 'hashed-password',
        role: UserRole.Resident,
    };

    const mockTokens = { externalId: 'user-external-id', accessToken: 'access-token', refreshToken: 'refresh-token' };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleAuthService,
                {
                    provide: AuthService,
                    useValue: { generateTokens: jest.fn().mockResolvedValue(mockTokens) },
                },
                {
                    provide: UsersService,
                    useValue: {
                        findByEmail: jest.fn(),
                        findByGoogleIdHash: jest.fn(),
                        getUserByExternalId: jest.fn(),
                        create: jest.fn(),
                        linkGoogleAccount: jest.fn(),
                        unlinkGoogleAccount: jest.fn(),
                    },
                },
                {
                    provide: RegistrationRequestsService,
                    useValue: { getApprovedRequestByEmail: jest.fn() },
                },
                {
                    provide: GoogleTokenVerifierService,
                    useValue: { verifyIdToken: jest.fn().mockResolvedValue(mockProfile) },
                },
            ],
        }).compile();

        service = module.get<GoogleAuthService>(GoogleAuthService);
        authService = module.get(AuthService);
        usersService = module.get(UsersService);
        registrationRequestsService = module.get(RegistrationRequestsService);
        googleTokenVerifier = module.get(GoogleTokenVerifierService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('should issue tokens for the user already linked to the google account', async () => {
            const linkedUser = { ...mockUser, googleIdHash: 'google-sub-hash-123' };
            usersService.findByGoogleIdHash.mockResolvedValue(linkedUser as never);

            const result = await service.login('id-token');

            expect(result).toEqual(mockTokens);
            expect(googleTokenVerifier.verifyIdToken).toHaveBeenCalledWith('id-token');
            expect(authService.generateTokens).toHaveBeenCalledWith(linkedUser);
            expect(usersService.findByEmail).not.toHaveBeenCalled();
            expect(usersService.create).not.toHaveBeenCalled();
        });

        it('should link the google account to the existing user with the same email and issue tokens', async () => {
            const linkedUser = { ...mockUser, googleIdHash: 'google-sub-hash-123', googleEmail: 'test@example.com' };
            usersService.findByGoogleIdHash.mockResolvedValue(undefined as never);
            usersService.findByEmail.mockResolvedValue(mockUser as never);
            usersService.linkGoogleAccount.mockResolvedValue(linkedUser as never);

            const result = await service.login('id-token');

            expect(result).toEqual(mockTokens);
            expect(usersService.linkGoogleAccount).toHaveBeenCalledWith('user-external-id', 'google-sub-hash-123', 'test@example.com');
            expect(authService.generateTokens).toHaveBeenCalledWith(linkedUser);
        });

        it('should throw FieldConflictException when the existing user is linked to another google account', async () => {
            usersService.findByGoogleIdHash.mockResolvedValue(undefined as never);
            usersService.findByEmail.mockResolvedValue({ ...mockUser, googleIdHash: 'another-google-sub-hash' } as never);

            await expect(service.login('id-token')).rejects.toThrow(FieldConflictException);
            expect(usersService.linkGoogleAccount).not.toHaveBeenCalled();
        });

        it('should register a new user when the email has an approved registration request', async () => {
            const newUser = { ...mockUser, password: undefined, googleIdHash: 'google-sub-hash-123', role: UserRole.Guest };
            usersService.findByGoogleIdHash.mockResolvedValue(undefined as never);
            usersService.findByEmail.mockResolvedValue(undefined as never);
            registrationRequestsService.getApprovedRequestByEmail.mockResolvedValue({
                status: RegistrationRequestStatus.Approved,
                role: UserRole.Guest,
            } as never);
            usersService.create.mockResolvedValue(newUser as never);

            const result = await service.login('id-token');

            expect(result).toEqual(mockTokens);
            expect(usersService.create).toHaveBeenCalledWith({
                email: 'test@example.com',
                role: UserRole.Guest,
                googleIdHash: 'google-sub-hash-123',
                googleEmail: 'test@example.com',
            });
            expect(authService.generateTokens).toHaveBeenCalledWith(newUser);
        });

        it('should not register a user when there is no approved registration request', async () => {
            usersService.findByGoogleIdHash.mockResolvedValue(undefined as never);
            usersService.findByEmail.mockResolvedValue(undefined as never);
            registrationRequestsService.getApprovedRequestByEmail.mockRejectedValue(
                new FieldValidationException('Your registration request has been rejected.', 'status'),
            );

            await expect(service.login('id-token')).rejects.toThrow(FieldValidationException);
            expect(usersService.create).not.toHaveBeenCalled();
            expect(authService.generateTokens).not.toHaveBeenCalled();
        });

        it('should not resolve a user when the id token is not valid', async () => {
            googleTokenVerifier.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

            await expect(service.login('invalid-token')).rejects.toThrow(Error);
            expect(usersService.findByGoogleIdHash).not.toHaveBeenCalled();
        });
    });

    describe('linkAccount', () => {
        it('should link the google account to the current user', async () => {
            const linkedUser = { ...mockUser, googleIdHash: 'google-sub-hash-123', googleEmail: 'test@example.com' };
            usersService.getUserByExternalId.mockResolvedValue(mockUser as never);
            usersService.findByGoogleIdHash.mockResolvedValue(undefined as never);
            usersService.linkGoogleAccount.mockResolvedValue(linkedUser as never);

            const result = await service.linkAccount('user-external-id', 'id-token');

            expect(result).toEqual(linkedUser);
            expect(usersService.linkGoogleAccount).toHaveBeenCalledWith('user-external-id', 'google-sub-hash-123', 'test@example.com');
        });

        it('should be idempotent when the same google account is already linked', async () => {
            const linkedUser = { ...mockUser, googleIdHash: 'google-sub-hash-123' };
            usersService.getUserByExternalId.mockResolvedValue(linkedUser as never);

            const result = await service.linkAccount('user-external-id', 'id-token');

            expect(result).toEqual(linkedUser);
            expect(usersService.linkGoogleAccount).not.toHaveBeenCalled();
        });

        it('should throw FieldConflictException when the user is linked to another google account', async () => {
            usersService.getUserByExternalId.mockResolvedValue({ ...mockUser, googleIdHash: 'another-google-sub-hash' } as never);

            await expect(service.linkAccount('user-external-id', 'id-token')).rejects.toThrow(FieldConflictException);
            expect(usersService.linkGoogleAccount).not.toHaveBeenCalled();
        });

        it('should throw FieldConflictException when the google account is linked to another user', async () => {
            usersService.getUserByExternalId.mockResolvedValue(mockUser as never);
            usersService.findByGoogleIdHash.mockResolvedValue({ ...mockUser, externalId: 'another-user-external-id' } as never);

            await expect(service.linkAccount('user-external-id', 'id-token')).rejects.toThrow(FieldConflictException);
            expect(usersService.linkGoogleAccount).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException when the user does not exist', async () => {
            usersService.getUserByExternalId.mockRejectedValue(new NotFoundException());

            await expect(service.linkAccount('missing-external-id', 'id-token')).rejects.toThrow(NotFoundException);
        });
    });

    describe('unlinkAccount', () => {
        it('should unlink the google account from the current user', async () => {
            const unlinkedUser = { ...mockUser, googleIdHash: undefined, googleEmail: undefined };
            usersService.getUserByExternalId.mockResolvedValue({ ...mockUser, googleIdHash: 'google-sub-hash-123' } as never);
            usersService.unlinkGoogleAccount.mockResolvedValue(unlinkedUser as never);

            const result = await service.unlinkAccount('user-external-id');

            expect(result).toEqual(unlinkedUser);
            expect(usersService.unlinkGoogleAccount).toHaveBeenCalledWith('user-external-id');
        });

        it('should throw FieldValidationException when no google account is linked', async () => {
            usersService.getUserByExternalId.mockResolvedValue(mockUser as never);

            await expect(service.unlinkAccount('user-external-id')).rejects.toThrow(FieldValidationException);
            expect(usersService.unlinkGoogleAccount).not.toHaveBeenCalled();
        });

        it('should throw FieldValidationException when the user has no password to sign in with', async () => {
            usersService.getUserByExternalId.mockResolvedValue({
                ...mockUser,
                password: undefined,
                googleIdHash: 'google-sub-hash-123',
            } as never);

            await expect(service.unlinkAccount('user-external-id')).rejects.toMatchObject({
                response: {
                    details: {
                        errors: [
                            {
                                message:
                                    'Cannot unlink the Google account because the user has no password set. Please set a password first.',
                                path: 'password',
                            },
                        ],
                    },
                },
            });
            expect(usersService.unlinkGoogleAccount).not.toHaveBeenCalled();
        });
    });
});
