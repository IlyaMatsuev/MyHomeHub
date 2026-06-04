import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';
import { UsersService } from 'users/users.service';
import { LoginResponseDto, RegisterResponseDto } from 'auth/dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    async login(email: string, password: string): Promise<LoginResponseDto> {
        const user = await this.usersService.findByEmail(email);
        if (!user || !(await this.verifyUserPasswordHash(user.password, password))) {
            throw new UnauthorizedException();
        }

        const jwtSecret = this.configService.get<string>('JWT_SECRET');
        const accessToken = await this.jwtService.signAsync({ sub: user.id, email }, { secret: jwtSecret });
        return { accessToken };
    }

    async register(email: string, password: string, totp: string): Promise<RegisterResponseDto> {
        if (!this.verifyTotp(totp)) {
            this.logger.debug(`Registration one-time password is not valid`);
            throw new UnauthorizedException();
        }
        const newUser = await this.usersService.create(email, await this.generateUserPasswordHash(password));
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
}
