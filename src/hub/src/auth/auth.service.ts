import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'users/users.service';
import { LoginResult } from 'auth/interfaces';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    async login(email: string, password: string): Promise<LoginResult> {
        const user = await this.usersService.findByEmail(email);
        // TODO: Compare passwords hash
        if (!user || user.password !== password) {
            throw new UnauthorizedException();
        }

        const jwtSecret = this.configService.get<string>('JWT_SECRET');
        const accessToken = await this.jwtService.signAsync({ sub: user.id, email }, { secret: jwtSecret });
        return { accessToken };
    }
}
