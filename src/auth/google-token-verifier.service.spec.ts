import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { AuthConfigService } from './auth-config.service';

jest.mock('google-auth-library');

describe('GoogleTokenVerifierService', () => {
    let service: GoogleTokenVerifierService;
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

    beforeEach(async () => {
        verifyIdToken = jest.fn();
        (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({ verifyIdToken }));

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleTokenVerifierService,
                {
                    provide: AuthConfigService,
                    useValue: mockAuthConfig,
                },
            ],
        }).compile();

        service = module.get<GoogleTokenVerifierService>(GoogleTokenVerifierService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        mockAuthConfig.getGoogleClientIds.mockReturnValue(['web-client-id', 'ios-client-id']);
    });

    describe('verifyIdToken', () => {
        it('should return the google profile with a lowercased email', async () => {
            verifyIdToken.mockResolvedValue(mockTicket(mockPayload));

            const result = await service.verifyIdToken('id-token');

            expect(result).toEqual({ googleId: 'google-sub-123', email: 'test@example.com', name: 'Test User' });
        });

        it('should verify the token against every configured client id', async () => {
            verifyIdToken.mockResolvedValue(mockTicket(mockPayload));

            await service.verifyIdToken('id-token');

            expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'id-token', audience: ['web-client-id', 'ios-client-id'] });
        });

        it('should throw ServiceUnavailableException when no client id is configured', async () => {
            mockAuthConfig.getGoogleClientIds.mockReturnValue([]);

            await expect(service.verifyIdToken('id-token')).rejects.toThrow(ServiceUnavailableException);
            expect(verifyIdToken).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException when the token verification fails', async () => {
            verifyIdToken.mockRejectedValue(new Error('Wrong recipient'));

            await expect(service.verifyIdToken('invalid-token')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when the token payload has no account details', async () => {
            verifyIdToken.mockResolvedValue(mockTicket({ sub: 'google-sub-123' }));

            await expect(service.verifyIdToken('id-token')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when the google email is not verified', async () => {
            verifyIdToken.mockResolvedValue(mockTicket({ ...mockPayload, email_verified: false }));

            await expect(service.verifyIdToken('id-token')).rejects.toThrow(UnauthorizedException);
        });
    });
});
