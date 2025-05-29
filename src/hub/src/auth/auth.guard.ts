import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from 'auth/decorators';

@Injectable()
export class AuthGuard implements CanActivate {
    private readonly logger = new Logger(AuthGuard.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.logger.debug(`is public endpoint: ${this.isPublicEndpoint(context)}, ${context.getHandler()}, ${context.getClass()}`);
        if (this.isPublicEndpoint(context)) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);
        this.logger.debug(`Provided token ${token}`);
        if (!token) {
            throw new UnauthorizedException();
        }

        try {
            const jwtSecret = this.configService.get<string>('JWT_SECRET');
            request['user'] = await this.jwtService.verifyAsync(token, { secret: jwtSecret });
        } catch (error) {
            this.logger.debug(`Error: ${error}`);
            throw new UnauthorizedException();
        }
        return true;
    }

    private isPublicEndpoint(context: ExecutionContext): boolean {
        return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
