import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type Redis from 'ioredis';
import { AuthConfigService } from 'auth/auth-config.service';
import { PASSWORD_RESET_REDIS_CLIENT, PASSWORD_RESET_TOKEN_BYTES, PASSWORD_RESET_TOKEN_REDIS_KEY_PREFIX } from 'auth/auth.constants';

@Injectable()
export class PasswordResetTokensService {
    constructor(
        @Inject(PASSWORD_RESET_REDIS_CLIENT)
        private readonly redis: Redis,
        private readonly authConfig: AuthConfigService,
    ) {}

    async issue(userExternalId: string): Promise<string> {
        const rawToken = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('base64url');
        const key = this.buildKey(rawToken);
        await this.redis.set(key, userExternalId, 'EX', this.authConfig.getPasswordResetTokenTtlSec());
        return rawToken;
    }

    async consume(rawToken: string): Promise<string> {
        const userExternalId = await this.redis.getdel(this.buildKey(rawToken));
        if (!userExternalId) {
            throw new UnauthorizedException();
        }
        return userExternalId;
    }

    private buildKey(rawToken: string): string {
        const hash = createHash('sha256').update(rawToken).digest('hex');
        return `${PASSWORD_RESET_TOKEN_REDIS_KEY_PREFIX}:${hash}`;
    }
}
