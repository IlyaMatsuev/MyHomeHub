import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from 'users/interfaces';
import { UserResponseDto } from 'users/dto';
import { AuthenticatedUser } from 'auth/interfaces';
import { CookiesConfigService } from 'auth/cookies/cookies-config.service';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';

describe('GoogleAuthController', () => {
    let controller: GoogleAuthController;
    let mockGoogleAuthService: {
        login: jest.Mock;
        linkAccount: jest.Mock;
        unlinkAccount: jest.Mock;
    };

    const mockAuthenticatedUser: AuthenticatedUser = {
        userId: 'user-external-id',
        email: 'test@example.com',
        role: UserRole.Resident,
    };

    const mockUser = {
        externalId: 'user-external-id',
        email: 'test@example.com',
        password: 'hashed-password',
        role: UserRole.Resident,
        googleIdHash: 'google-sub-hash-123',
        googleEmail: 'test@example.com',
    };

    beforeEach(async () => {
        mockGoogleAuthService = {
            login: jest.fn(),
            linkAccount: jest.fn(),
            unlinkAccount: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [GoogleAuthController],
            providers: [
                {
                    provide: GoogleAuthService,
                    useValue: mockGoogleAuthService,
                },
                {
                    provide: CookiesConfigService,
                    useValue: { get: jest.fn(() => ({})) },
                },
            ],
        }).compile();

        controller = module.get<GoogleAuthController>(GoogleAuthController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('loginWithGoogle', () => {
        it('should call googleAuthService.login with the id token and return tokens', async () => {
            const tokens = { externalId: 'user-external-id', accessToken: 'jwt-token', refreshToken: 'refresh-token' };
            mockGoogleAuthService.login.mockResolvedValue(tokens);

            const result = await controller.loginWithGoogle({ idToken: 'id-token' });

            expect(result).toEqual(tokens);
            expect(mockGoogleAuthService.login).toHaveBeenCalledWith('id-token');
        });
    });

    describe('linkGoogleAccount', () => {
        it('should link the account of the authenticated user and return the updated profile', async () => {
            mockGoogleAuthService.linkAccount.mockResolvedValue(mockUser);

            const result = await controller.linkGoogleAccount(mockAuthenticatedUser, { idToken: 'id-token' });

            expect(result).toEqual(new UserResponseDto(mockUser));
            expect(result.googleLinked).toBe(true);
            expect(mockGoogleAuthService.linkAccount).toHaveBeenCalledWith('user-external-id', 'id-token');
        });
    });

    describe('unlinkGoogleAccount', () => {
        it('should unlink the account of the authenticated user and return the updated profile', async () => {
            mockGoogleAuthService.unlinkAccount.mockResolvedValue({ ...mockUser, googleIdHash: undefined, googleEmail: undefined });

            const result = await controller.unlinkGoogleAccount(mockAuthenticatedUser);

            expect(result.googleLinked).toBe(false);
            expect(result.googleEmail).toBeUndefined();
            expect(mockGoogleAuthService.unlinkAccount).toHaveBeenCalledWith('user-external-id');
        });
    });
});
