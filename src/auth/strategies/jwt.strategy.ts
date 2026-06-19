import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser, JwtPayload } from 'auth/interfaces';
import { UsersService } from 'users/users.service';
import { AuthConfigService } from 'auth/auth-config.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        authConfig: AuthConfigService,
        private readonly usersService: UsersService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: authConfig.getJwtSecret(),
        });
    }

    async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
        const user = await this.usersService.findByExternalId(payload.sub);
        if (!user) {
            throw new UnauthorizedException();
        }
        return { userId: user.externalId, email: user.email, role: user.role };
    }
}
