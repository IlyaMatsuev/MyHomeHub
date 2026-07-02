import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';
import { UsersService } from 'users/users.service';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import { RegistrationRequestStatus, User, UserRole } from 'users/interfaces';
import { TOTP_REGISTERED_USER_ROLE } from 'users/users.constants';
import { LoginResponseDto, RegisterResponseDto } from 'auth/dto';
import { JwtPayload } from 'auth/interfaces';
import { FieldValidationException } from 'common/exceptions';
import { AuthConfigService } from 'auth/auth-config.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly authConfig: AuthConfigService,
        private readonly registrationRequestsService: RegistrationRequestsService,
    ) {}

    async login(email: string, password: string): Promise<LoginResponseDto> {
        const user = await this.usersService.findByEmail(email);
        if (!user || !(await this.verifyUserPasswordHash(user.password, password))) {
            throw new UnauthorizedException();
        }
        return this.generateTokens(user);
    }

    async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
        let payload: JwtPayload;
        try {
            payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
                secret: this.authConfig.getJwtRefreshSecret(),
            });
        } catch {
            throw new UnauthorizedException();
        }

        const user = await this.usersService.getUserByExternalId(payload.sub, { strict: false });
        if (!user) {
            throw new UnauthorizedException();
        }

        return this.generateTokens(user);
    }

    async register(email: string, password: string, totp?: string): Promise<RegisterResponseDto> {
        if (totp) {
            if (!this.verifyTotp(totp)) {
                this.logger.debug(`Registration one-time password is not valid`);
                throw new ForbiddenException();
            }
            const passwordHash = await this.generateUserPasswordHash(password);
            const newUser = await this.usersService.create(email, passwordHash, TOTP_REGISTERED_USER_ROLE);
            await this.registrationRequestsService.createAutoApprovedRequest(email);
            return { externalId: newUser.externalId, email: newUser.email, role: UserRole[newUser.role] };
        }

        const registrationRequest = await this.registrationRequestsService.getRequestByEmail(email);
        if (!registrationRequest) {
            throw new FieldValidationException(
                'No registration request found for this email. Please submit a registration request first.',
                'email',
            );
        }

        if (registrationRequest.status === RegistrationRequestStatus.Pending) {
            throw new FieldValidationException(
                'Your registration request has not been reviewed yet. Please wait for admin approval.',
                'status',
            );
        }

        if (registrationRequest.status === RegistrationRequestStatus.Rejected) {
            throw new FieldValidationException('Your registration request has been rejected.', 'status');
        }

        const newUser = await this.usersService.create(email, await this.generateUserPasswordHash(password), registrationRequest.role);
        return { externalId: newUser.externalId, email: newUser.email, role: UserRole[newUser.role] };
    }

    verifyTotp(token: string): boolean {
        return speakeasy.totp.verify({ secret: this.authConfig.getTotpSecret(), encoding: 'base32', token });
    }

    generateUserPasswordHash(password: string): Promise<string> {
        const passwordHashSecret = this.authConfig.getUserPasswordSecret();
        const passwordHashSalt = this.authConfig.getUserPasswordSalt();
        return argon2.hash(password, { secret: Buffer.from(passwordHashSecret), salt: Buffer.from(passwordHashSalt) });
    }

    verifyUserPasswordHash(hash: string, password: string): Promise<boolean> {
        return argon2.verify(hash, password, { secret: Buffer.from(this.authConfig.getUserPasswordSecret()) });
    }

    private async generateTokens(user: User): Promise<LoginResponseDto> {
        const payload: JwtPayload = { sub: user.externalId };
        const accessToken = await this.jwtService.signAsync(payload, {
            secret: this.authConfig.getJwtSecret(),
            expiresIn: this.authConfig.getJwtExpTimeout(),
        });
        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: this.authConfig.getJwtRefreshSecret(),
            expiresIn: this.authConfig.getJwtRefreshExpTimeout(),
        });
        return { externalId: user.externalId, accessToken, refreshToken };
    }
}
