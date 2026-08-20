import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { GoogleProfile } from 'auth/interfaces';
import { AuthConfigService } from 'auth/auth-config.service';

/**
 * Verifies the Google ID tokens issued to the hub clients (WEB or IOS app).
 *
 * The clients run the Google Sign-In flow themselves and send the resulting ID token to the hub,
 * so the server never needs a client secret nor a publicly reachable OAuth redirect URI
 */
@Injectable()
export class GoogleTokenVerifierService {
    private readonly logger = new Logger(GoogleTokenVerifierService.name);
    private readonly client = new OAuth2Client();

    constructor(private readonly authConfig: AuthConfigService) {}

    async verifyIdToken(idToken: string): Promise<GoogleProfile> {
        const audience = this.authConfig.getGoogleClientIds();
        if (!audience.length) {
            throw new ServiceUnavailableException('Google authentication is not configured on this server');
        }

        let payload: TokenPayload;
        try {
            const ticket = await this.client.verifyIdToken({ idToken, audience });
            payload = ticket.getPayload();
        } catch (error) {
            this.logger.debug(`Google ID token verification failed: ${error?.message}`);
            throw new UnauthorizedException('The provided Google ID token is not valid');
        }

        if (!payload?.sub || !payload?.email) {
            throw new UnauthorizedException('The provided Google ID token does not contain the account details');
        }
        if (!payload.email_verified) {
            throw new UnauthorizedException('The email of the provided Google account is not verified');
        }

        return { googleId: payload.sub, email: payload.email.toLowerCase(), name: payload.name };
    }
}
