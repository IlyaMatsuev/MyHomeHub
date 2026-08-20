import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from 'users/users.service';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import { User } from 'users/interfaces';
import { LoginResponseDto } from 'auth/dto';
import { GoogleProfile } from 'auth/interfaces';
import { AuthService } from 'auth/auth.service';
import { GoogleTokenVerifierService } from 'auth/google-token-verifier.service';
import { FieldConflictException, FieldValidationException } from 'common/exceptions';

@Injectable()
export class GoogleAuthService {
    private readonly logger = new Logger(GoogleAuthService.name);

    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
        private readonly registrationRequestsService: RegistrationRequestsService,
        private readonly googleTokenVerifier: GoogleTokenVerifierService,
    ) {}

    /**
     * Signs in the owner of the Google account the ID token was issued for.
     *
     * The account is registered on the fly when its email has an approved registration request,
     * so the Google sign-up follows the same approval policy as the regular one
     */
    async login(idToken: string): Promise<LoginResponseDto> {
        const profile = await this.googleTokenVerifier.verifyIdToken(idToken);
        return this.authService.generateTokens(await this.resolveUser(profile));
    }

    async linkAccount(userExternalId: string, idToken: string): Promise<User> {
        const profile = await this.googleTokenVerifier.verifyIdToken(idToken);
        const user = await this.usersService.getUserByExternalId(userExternalId);
        if (user.googleId === profile.googleId) {
            return user;
        }
        if (user.googleId) {
            throw new FieldConflictException('This user is already linked to another Google account', 'idToken');
        }
        if (await this.usersService.findByGoogleId(profile.googleId)) {
            throw new FieldConflictException('This Google account is already linked to another user', 'idToken');
        }

        this.logger.debug(`Linking a Google account to the user ${user.externalId}`);
        return this.usersService.linkGoogleAccount(user.externalId, profile.googleId, profile.email);
    }

    async unlinkAccount(userExternalId: string): Promise<User> {
        const user = await this.usersService.getUserByExternalId(userExternalId);
        if (!user.googleId) {
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

    private async resolveUser(profile: GoogleProfile): Promise<User> {
        const linkedUser = await this.usersService.findByGoogleId(profile.googleId);
        if (linkedUser) {
            return linkedUser;
        }

        // Google has verified the email ownership, so the account registered with the same email belongs to the same person
        const existingUser = await this.usersService.findByEmail(profile.email);
        if (existingUser) {
            if (existingUser.googleId) {
                throw new FieldConflictException('This user is already linked to another Google account', 'idToken');
            }
            this.logger.debug(`Linking a Google account to the existing user ${existingUser.externalId}`);
            return this.usersService.linkGoogleAccount(existingUser.externalId, profile.googleId, profile.email);
        }

        const registrationRequest = await this.registrationRequestsService.getApprovedRequestByEmail(profile.email);

        this.logger.debug(`Registering a new user with a Google account for the email ${profile.email}`);
        return this.usersService.create({
            email: profile.email,
            role: registrationRequest.role,
            googleId: profile.googleId,
            googleEmail: profile.email,
        });
    }
}
