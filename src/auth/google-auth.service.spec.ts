import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { FieldConflictException, FieldValidationException } from 'common/exceptions';
import { UsersService } from 'users/users.service';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import { RegistrationRequestStatus, UserRole } from 'users/interfaces';
import { GoogleAuthService } from './google-auth.service';
import { AuthConfigService } from './auth-config.service';
import { AuthService } from './auth.service';

jest.mock('google-auth-library');

describe('GoogleAuthService', () => {
    let service: GoogleAuthService;
    let authService: jest.Mocked<AuthService>;
    let usersService: jest.Mocked<UsersService>;
    let registrationRequestsService: jest.Mocked<RegistrationRequestsService>;
    let verifyIdToken: jest.Mock;

    const mockAuthConfig = {
        getGoogleClientIds: jest.fn().mockReturnValue(['web-client-id', 'ios-client-id']),
    };

    const mockPayload = {
        sub: 'google-sub-123',
        email: 'Test@Example.com',
        email_verified: true,
        name: 'Test User',
    };

    const mockTicket = (payload: unknown) => ({ getPayload: jest.fn().mockReturnValue(payload) });

    // SHA-256 of the "google-sub-123" account id, the service hashes the "sub" claim itself
    const mockGoogleIdHash = '063b18a156ad902b3baec17855a4dad8b0e771d2feded36a8bc004088beb8c55';

    const mockUser = {
        externalId: 'user-external-id',
        email: 'test@example.com',
        password: 'hashed-password',
        role: UserRole.Resident,
    };

    const mockTokens = { externalId: 'user-external-id', accessToken: 'access-token', refreshToken: 'refresh-token' };

    beforeEach(async () => {
        verifyIdToken = jest.fn().mockResolvedValue(mockTicket(mockPayload));
        (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({ verifyIdToken }));

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleAuthService,
                {
                    provide: AuthService,
                    useValue: { generateTokens: jest.fn().mockResolvedValue(mockTokens) },
                },
                {
                    provide: AuthConfigService,
                    useValue: mockAuthConfig,
                },
                {
                    provide: UsersService,
                    useValue: {
                        findByEmail: jest.fn(),
                        findByGoogleIdHash: jest.fn(),
                        findByExternalId: jest.fn(),
                        create: jest.fn(),
                        linkGoogleAccount: jest.fn(),
                        unlinkGoogleAccount: jest.fn(),
                    },
                },
                {
                    provide: RegistrationRequestsService,
                    useValue: { getApprovedRequestByEmail: jest.fn() },
                },
            ],
        }).compile();

        service = module.get<GoogleAuthService>(GoogleAuthService);
        authService = module.get(AuthService);
        usersService = module.get(UsersService);
        registrationRequestsService = module.get(RegistrationRequestsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        mockAuthConfig.getGoogleClientIds.mockReturnValue(['web-client-id', 'ios-client-id']);
    });

    describe('id token verification', () => {
        it('should hash the google account id and lowercase the email before resolving the user', async () => {
            usersService.findByGoogleIdHash.mockResolvedValue(undefined as never);
            usersService.findByEmail.mockResolvedValue(mockUser as never);
            usersService.linkGoogleAccount.mockResolvedValue(mockUser as never);

            await service.login('id-token');

            expect(usersService.findByGoogleIdHash).toHaveBeenCalledWith(mockGoogleIdHash);
            expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
        });

        it('should never expose the google account id as is', async () => {
            usersService.findByGoogleIdHash.mockResolvedValue(mockUser as never);

            await service.login('id-token');

            expect(JSON.stringify(usersService.findByGoogleIdHash.mock.calls)).not.toContain(mockPayload.sub);
        });

        it('should verify the token against every configured client id', async () => {
            usersService.findByGoogleIdHash.mockResolvedValue(mockUser as never);

            await service.login('id-token');

            expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'id-token', audience: ['web-client-id', 'ios-client-id'] });
        });

        it('should throw ServiceUnavailableException when no client id is configured', async () => {
            mockAuthConfig.getGoogleClientIds.mockReturnValue([]);

            await expect(service.login('id-token')).rejects.toThrow(ServiceUnavailableException);
            expect(verifyIdToken).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException when the token verification fails', async () => {
            verifyIdToken.mockRejectedValue(new Error('Wrong recipient'));

            await expect(service.login('invalid-token')).rejects.toThrow(UnauthorizedException);
            expect(usersService.findByGoogleIdHash).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException when the token payload has no account details', async () => {
            verifyIdToken.mockResolvedValue(mockTicket({ sub: 'google-sub-123' }));

            await expect(service.login('id-token')).rejects.toThrow(UnauthorizedException);
            expect(usersService.findByGoogleIdHash).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException when the google email is not verified', async () => {
            verifyIdToken.mockResolvedValue(mockTicket({ ...mockPayload, email_verified: false }));

            await expect(service.login('id-token')).rejects.toThrow(UnauthorizedException);
            expect(usersService.findByGoogleIdHash).not.toHaveBeenCalled();
        });

        it('should verify the token before touching the user when linking an account', async () => {
            verifyIdToken.mockRejectedValue(new Error('Wrong recipient'));

            await expect(service.linkAccount('user-external-id', 'invalid-token')).rejects.toThrow(UnauthorizedException);
            expect(usersService.findByExternalId).not.toHaveBeenCalled();
        });
    });

    describe('login', () => {
        it('should issue tokens for the user already linked to the google account', async () => {
            const linkedUser = { ...mockUser, googleIdHash: mockGoogleIdHash };
            usersService.findByGoogleIdHash.mockResolvedValue(linkedUser as never);

            const result = await service.login('id-token');

            expect(result).toEqual(mockTokens);
            expect(authService.generateTokens).toHaveBeenCalledWith(linkedUser);
            expect(usersService.findByEmail).not.toHaveBeenCalled();
            expect(usersService.create).not.toHaveBeenCalled();
        });

        it('should link the google account to the existing user with the same email and issue tokens', async () => {
            const linkedUser = { ...mockUser, googleIdHash: mockGoogleIdHash, googleEmail: 'test@example.com' };
            usersService.findByGoogleIdHash.mockResolvedValue(undefined as never);
            usersService.findByEmail.mockResolvedValue(mockUser as never);
            usersService.linkGoogleAccount.mockResolvedValue(linkedUser as never);

            const result = await service.login('id-token');

            expect(result).toEqual(mockTokens);
            expect(usersService.linkGoogleAccount).toHaveBeenCalledWith('user-external-id', mockGoogleIdHash, 'test@example.com');
            expect(authService.generateTokens).toHaveBeenCalledWith(linkedUser);
        });

        it('should throw FieldConflictException when the existing user is linked to another google account', async () => {
            usersService.findByGoogleIdHash.mockResolvedValue(undefined as never);
            usersService.findByEmail.mockResolvedValue({ ...mockUser, googleIdHash: 'another-google-sub-hash' } as never);

            await expect(service.login('id-token')).rejects.toThrow(FieldConflictException);
            expect(usersService.linkGoogleAccount).not.toHaveBeenCalled();
        });

        it('should register a new user when the email has an approved registration request', async () => {
            const newUser = { ...mockUser, password: undefined, googleIdHash: mockGoogleIdHash, role: UserRole.Guest };
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
                googleIdHash: mockGoogleIdHash,
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
            verifyIdToken.mockRejectedValue(new Error('Invalid token'));

            await expect(service.login('invalid-token')).rejects.toThrow(UnauthorizedException);
            expect(usersService.findByGoogleIdHash).not.toHaveBeenCalled();
        });
    });

    describe('linkAccount', () => {
        it('should link the google account to the current user', async () => {
            const linkedUser = { ...mockUser, googleIdHash: mockGoogleIdHash, googleEmail: 'test@example.com' };
            usersService.findByExternalId.mockResolvedValue(mockUser as never);
            usersService.findByGoogleIdHash.mockResolvedValue(undefined as never);
            usersService.linkGoogleAccount.mockResolvedValue(linkedUser as never);

            const result = await service.linkAccount('user-external-id', 'id-token');

            expect(result).toEqual(linkedUser);
            expect(usersService.linkGoogleAccount).toHaveBeenCalledWith('user-external-id', mockGoogleIdHash, 'test@example.com');
        });

        it('should be idempotent when the same google account is already linked', async () => {
            const linkedUser = { ...mockUser, googleIdHash: mockGoogleIdHash };
            usersService.findByExternalId.mockResolvedValue(linkedUser as never);

            const result = await service.linkAccount('user-external-id', 'id-token');

            expect(result).toEqual(linkedUser);
            expect(usersService.linkGoogleAccount).not.toHaveBeenCalled();
        });

        it('should throw FieldConflictException when the user is linked to another google account', async () => {
            usersService.findByExternalId.mockResolvedValue({ ...mockUser, googleIdHash: 'another-google-sub-hash' } as never);

            await expect(service.linkAccount('user-external-id', 'id-token')).rejects.toThrow(FieldConflictException);
            expect(usersService.linkGoogleAccount).not.toHaveBeenCalled();
        });

        it('should throw FieldConflictException when the google account is linked to another user', async () => {
            usersService.findByExternalId.mockResolvedValue(mockUser as never);
            usersService.findByGoogleIdHash.mockResolvedValue({ ...mockUser, externalId: 'another-user-external-id' } as never);

            await expect(service.linkAccount('user-external-id', 'id-token')).rejects.toThrow(FieldConflictException);
            expect(usersService.linkGoogleAccount).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException when the user does not exist', async () => {
            usersService.findByExternalId.mockRejectedValue(new NotFoundException());

            await expect(service.linkAccount('missing-external-id', 'id-token')).rejects.toThrow(NotFoundException);
        });
    });

    describe('unlinkAccount', () => {
        it('should unlink the google account from the current user', async () => {
            const unlinkedUser = { ...mockUser, googleIdHash: undefined, googleEmail: undefined };
            usersService.findByExternalId.mockResolvedValue({ ...mockUser, googleIdHash: mockGoogleIdHash } as never);
            usersService.unlinkGoogleAccount.mockResolvedValue(unlinkedUser as never);

            const result = await service.unlinkAccount('user-external-id');

            expect(result).toEqual(unlinkedUser);
            expect(usersService.unlinkGoogleAccount).toHaveBeenCalledWith('user-external-id');
        });

        it('should not verify an id token when unlinking', async () => {
            usersService.findByExternalId.mockResolvedValue({ ...mockUser, googleIdHash: mockGoogleIdHash } as never);
            usersService.unlinkGoogleAccount.mockResolvedValue(mockUser as never);

            await service.unlinkAccount('user-external-id');

            expect(verifyIdToken).not.toHaveBeenCalled();
        });

        it('should throw FieldValidationException when no google account is linked', async () => {
            usersService.findByExternalId.mockResolvedValue(mockUser as never);

            await expect(service.unlinkAccount('user-external-id')).rejects.toThrow(FieldValidationException);
            expect(usersService.unlinkGoogleAccount).not.toHaveBeenCalled();
        });

        it('should throw FieldValidationException when the user has no password to sign in with', async () => {
            usersService.findByExternalId.mockResolvedValue({
                ...mockUser,
                password: undefined,
                googleIdHash: mockGoogleIdHash,
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
