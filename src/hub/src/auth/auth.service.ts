import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from 'users/users.service';
import { LoginResult } from 'auth/interfaces';
import { NewUser } from 'users/interfaces';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    async login(email: string, password: string): Promise<LoginResult> {
        const user = await this.usersService.findByEmail(email);
        if (!user || !(await this.verifyUserPasswordHash(user.password, password))) {
            throw new UnauthorizedException();
        }

        const jwtSecret = this.configService.get<string>('JWT_SECRET');
        const accessToken = await this.jwtService.signAsync({ sub: user.id, email }, { secret: jwtSecret });
        return { accessToken };
    }

    async register(email: string, password: string, accessKey: string): Promise<NewUser> {
        if (!this.verifyAccessKeyHash(accessKey)) {
            this.logger.debug(`Registration access key is invalid`);
            throw new UnauthorizedException();
        }
        const newUser = await this.usersService.create(email, await this.generateUserPasswordHash(password));
        return { id: newUser._id, email: newUser.email };
    }

    verifyAccessKeyHash(accessKey: string): boolean {
        const actualAccessKey = this.configService.get<string>('REGISTRATION_ACCESS_KEY');
        return accessKey === actualAccessKey;
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
