import { createHash } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { UsersService } from 'users/users.service';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import { User } from 'users/interfaces';
import { LoginResponseDto } from 'auth/dto';
import { GoogleProfile } from 'auth/interfaces';
import { AuthService } from 'auth/auth.service';
import { AuthConfigService } from 'auth/auth-config.service';
import { FieldConflictException, FieldValidationException } from 'common/exceptions';

@Injectable()
export class GoogleAuthService {
    private readonly logger = new Logger(GoogleAuthService.name);
    private readonly client = new OAuth2Client();

    constructor(
        private readonly authService: AuthService,
        private readonly authConfig: AuthConfigService,
        private readonly usersService: UsersService,
        private readonly registrationRequestsService: RegistrationRequestsService,
    ) {}

    async login(idToken: string): Promise<LoginResponseDto> {
        const profile = await this.verifyIdToken(idToken);
        return this.authService.generateTokens(await this.resolveUserByGoogleEmail(profile));
    }

    async linkAccount(userExternalId: string, idToken: string): Promise<User> {
        const profile = await this.verifyIdToken(idToken);
        const user = await this.usersService.findByExternalId(userExternalId);
        if (user.googleIdHash === profile.googleIdHash) {
            return user;
        }
        if (user.googleIdHash) {
            throw new FieldConflictException('This user is already linked to another Google account', 'idToken');
        }
        if (await this.usersService.findByGoogleIdHash(profile.googleIdHash)) {
            throw new FieldConflictException('This Google account is already linked to another user', 'idToken');
        }
        return this.usersService.linkGoogleAccount(user.externalId, profile.googleIdHash, profile.email);
    }

    async unlinkAccount(userExternalId: string): Promise<User> {
        const user = await this.usersService.findByExternalId(userExternalId);
        if (!user.googleIdHash) {
            throw new FieldValidationException('There is no Google account linked to this user', 'googleId');
        }
        if (!user.password) {
            throw new FieldValidationException(
                'Cannot unlink the Google account because the user has no password set. Please set a password first.',
                'password',
            );
        }

        this.logger.debug(`Unlinking the Google account from the user ${user.externalId}`);
        return this.usersService.unlinkGoogleAccount(user.externalId);
    }

    private async resolveUserByGoogleEmail(profile: GoogleProfile): Promise<User> {
        const linkedUser = await this.usersService.findByGoogleIdHash(profile.googleIdHash);
        if (linkedUser) {
            return linkedUser;
        }

        const existingUser = await this.usersService.findByEmail(profile.email);
        if (existingUser) {
            if (existingUser.googleIdHash) {
                throw new FieldConflictException('This user is already linked to another Google account', 'idToken');
            }
            this.logger.debug(`Linking a Google account to the existing user ${existingUser.externalId}`);
            return this.usersService.linkGoogleAccount(existingUser.externalId, profile.googleIdHash, profile.email);
        }

        const registrationRequest = await this.registrationRequestsService.getApprovedRequestByEmail(profile.email);

        this.logger.debug(`Registering a new user with a Google account for the email ${profile.email}`);
        return this.usersService.create({
            email: profile.email,
            role: registrationRequest.role,
            googleIdHash: profile.googleIdHash,
            googleEmail: profile.email,
        });
    }

    private async verifyIdToken(idToken: string): Promise<GoogleProfile> {
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

        return { googleIdHash: this.hashGoogleId(payload.sub), email: payload.email.toLowerCase(), name: payload.name };
    }

    private hashGoogleId(googleId: string): string {
        return createHash('sha256').update(googleId).digest('hex');
    }
}
