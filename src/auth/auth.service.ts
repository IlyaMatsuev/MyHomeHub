import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';
import { UsersService } from 'users/users.service';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import { User, UserRole } from 'users/interfaces';
import { TOTP_REGISTERED_USER_ROLE } from 'users/users.constants';
import { LoginResponseDto, RegisterResponseDto, PasswordResetResponseDto } from 'auth/dto';
import { JwtPayload } from 'auth/interfaces';
import { AuthConfigService } from 'auth/auth-config.service';
import { PasswordResetTokensService } from 'auth/password-reset-tokens.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly authConfig: AuthConfigService,
        private readonly registrationRequestsService: RegistrationRequestsService,
        private readonly passwordResetTokensService: PasswordResetTokensService,
    ) {}

    async login(email: string, password: string): Promise<LoginResponseDto> {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException();
        }
        if (user.googleIdHash && !user.password) {
            throw new BadRequestException(`You do not have a password set up yet. Please use Google login.`);
        }
        if (!user.password || !(await this.verifyUserPasswordHash(user.password, password))) {
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

        const user = await this.usersService.findByExternalId(payload.sub, { strict: false });
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
            const newUser = await this.usersService.create({ email, password: passwordHash, role: TOTP_REGISTERED_USER_ROLE });
            await this.registrationRequestsService.createAutoApprovedRequest(email);
            return { externalId: newUser.externalId, email: newUser.email, role: UserRole[newUser.role] };
        }

        const registrationRequest = await this.registrationRequestsService.getApprovedRequestByEmail(email);
        const newUser = await this.usersService.create({
            email,
            password: await this.generateUserPasswordHash(password),
            role: registrationRequest.role,
        });
        return { externalId: newUser.externalId, email: newUser.email, role: UserRole[newUser.role] };
    }

    async requestPasswordReset(email: string, totp: string): Promise<PasswordResetResponseDto> {
        if (!this.verifyTotp(totp)) {
            throw new ForbiddenException('Password reset one-time password is not valid');
        }
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException();
        }
        const resetToken = await this.passwordResetTokensService.issue(user.externalId);
        return { resetToken };
    }

    async changePassword(resetToken: string, newPassword: string): Promise<void> {
        const userExternalId = await this.passwordResetTokensService.consume(resetToken);
        const user = await this.usersService.findByExternalId(userExternalId, { strict: false });
        if (!user) {
            throw new UnauthorizedException();
        }

        const passwordHash = await this.generateUserPasswordHash(newPassword);
        await this.usersService.updatePassword(user.externalId, passwordHash);
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

    async generateTokens(user: User): Promise<LoginResponseDto> {
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
