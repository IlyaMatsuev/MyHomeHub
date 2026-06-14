import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { seconds, ThrottlerModuleOptions, ThrottlerOptions, ThrottlerOptionsFactory } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { THROTTLER_DEFINITIONS } from 'throttler/throttler.constants';

@Injectable()
export class ThrottlerConfigFactory implements ThrottlerOptionsFactory {
    private readonly logger = new Logger(ThrottlerConfigFactory.name);

    private get throttlerEnabled(): boolean {
        return this.configService.get<string>('THROTTLE_ENABLED') === 'true';
    }

    private get redis(): Redis {
        const keyPrefix = this.configService.get<string>('REDIS_KEY_PREFIX');
        const host = this.configService.get<string>('REDIS_DOMAIN');
        const port = +this.configService.get<string>('REDIS_PORT');
        return new Redis({ keyPrefix, host, port });
    }

    constructor(private readonly configService: ConfigService) {}

    createThrottlerOptions(): ThrottlerModuleOptions {
        if (!this.throttlerEnabled) {
            return { throttlers: [] };
        }

        const throttlers = THROTTLER_DEFINITIONS.map(name => this.getDefinition(name)).filter(Boolean);
        if (!throttlers.length) {
            this.logger.warn(
                'Throttler rate limiter is enabled but no definition variables provided (e.g. THROTTLE_SHORT_TTL_SEC, THROTTLE_SHORT_LIMIT, etc.',
            );
        }
        return { throttlers, storage: new ThrottlerStorageRedisService(this.redis) };
    }

    private getDefinition(name: string): ThrottlerOptions | null {
        const uppercaseName = name.toUpperCase();
        const ttl = parseInt(this.configService.get<string>(`THROTTLE_${uppercaseName}_TTL_SEC`), 10);
        const limitPerTtl = parseInt(this.configService.get<string>(`THROTTLE_${uppercaseName}_LIMIT`), 10);
        if (isNaN(ttl) || isNaN(limitPerTtl)) {
            return null;
        }
        return { name, ttl: seconds(ttl), limit: limitPerTtl };
    }
}
