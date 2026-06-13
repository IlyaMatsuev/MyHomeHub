import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { seconds, ThrottlerModuleOptions, ThrottlerOptions, ThrottlerOptionsFactory } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { THROTTLER_DEFINITIONS } from 'throttler/throttler.constants';

@Injectable()
export class ThrottlerConfigFactory implements ThrottlerOptionsFactory {
    private get isEnabled(): boolean {
        return this.configService.get<string>('THROTTLE_ENABLED') === 'true';
    }

    private get getRedis(): Redis {
        const host = this.configService.get<string>('REDIS_DOMAIN');
        const port = +this.configService.get<string>('REDIS_PORT');
        return new Redis({ host, port });
    }

    constructor(private readonly configService: ConfigService) {}

    createThrottlerOptions(): ThrottlerModuleOptions {
        if (!this.isEnabled) {
            return { throttlers: [] };
        }

        return {
            throttlers: THROTTLER_DEFINITIONS.map(name => this.getDefinition(name)).filter(Boolean),
            storage: new ThrottlerStorageRedisService(this.getRedis),
        };
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
