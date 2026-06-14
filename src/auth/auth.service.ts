import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';
import { UsersService } from 'users/users.service';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import { RegistrationRequestStatus, User } from 'users/interfaces';
import { TOTP_REGISTRATION_ROLE } from 'users/users.constants';
import { LoginResponseDto, RegisterResponseDto } from 'auth/dto';
import { JwtPayload } from 'auth/interfaces';
import { FieldValidationException } from 'common/exceptions';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly registrationRequestsService: RegistrationRequestsService,
    ) {}

    async login(email?: string, password?: string, refreshToken?: string): Promise<LoginResponseDto> {
        if (refreshToken) {
            return this.refreshTokens(refreshToken);
        }

        const user = await this.usersService.findByEmail(email);
        if (!user || !(await this.verifyUserPasswordHash(user.password, password))) {
            throw new UnauthorizedException();
        }

        return this.generateTokens(user);
    }

    async refreshTokens(refreshToken: string): Promise<LoginResponseDto> {
        let payload: JwtPayload;
        try {
            payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            });
        } catch {
            throw new UnauthorizedException();
        }

        const user = await this.usersService.findByEmail(payload.email);
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
            const newUser = await this.usersService.create(email, await this.generateUserPasswordHash(password), TOTP_REGISTRATION_ROLE);
            await this.registrationRequestsService.createAutoApprovedRequest(email);
            return { email: newUser.email };
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
        return { email: newUser.email };
    }

    verifyTotp(token: string): boolean {
        return speakeasy.totp.verify({ secret: this.configService.get('REGISTRATION_TOTP_SECRET'), encoding: 'base32', token });
    }

    generateUserPasswordHash(password: string): Promise<string> {
        const passwordHashSecret = this.configService.get<string>('USER_PASSWORD_SECRET');
        const passwordHashSalt = this.configService.get<string>('USER_PASSWORD_SALT');
        return argon2.hash(password, { secret: Buffer.from(passwordHashSecret), salt: Buffer.from(passwordHashSalt) });
    }

    verifyUserPasswordHash(hash: string, password: string): Promise<boolean> {
        const passwordHashSecret = this.configService.get<string>('USER_PASSWORD_SECRET');
        return argon2.verify(hash, password, { secret: Buffer.from(passwordHashSecret) });
    }

    private async generateTokens(user: User): Promise<LoginResponseDto> {
        const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
        const accessToken = await this.jwtService.signAsync(payload, { secret: this.configService.get<string>('JWT_SECRET') });
        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            expiresIn: Number(this.configService.get('JWT_REFRESH_EXPIRATION_TIMEOUT')),
        });
        return { accessToken, refreshToken };
    }
}
