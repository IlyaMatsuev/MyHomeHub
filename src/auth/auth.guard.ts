import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from 'auth/decorators';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (this.isPublicEndpoint(context) || (this.isLocalEnvironment() && !this.isLocalAuthEnabled())) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);
        if (!token) {
            throw new UnauthorizedException();
        }

        try {
            const jwtSecret = this.configService.get<string>('JWT_SECRET');
            request['user'] = await this.jwtService.verifyAsync(token, { secret: jwtSecret });
        } catch {
            throw new UnauthorizedException();
        }
        return true;
    }

    private isPublicEndpoint(context: ExecutionContext): boolean {
        return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    }

    private isLocalEnvironment(): boolean {
        return this.configService.get<string>('NODE_ENV') === 'local';
    }

    private isLocalAuthEnabled(): boolean {
        return this.configService.get<string>('ENABLE_LOCAL_AUTH') === 'true';
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
