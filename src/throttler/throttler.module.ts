import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule as NestThrottlerModule, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

@Module({
    imports: [
        NestThrottlerModule.forRootAsync({
            useFactory: (configService: ConfigService) => {
                const throttleEnabled = configService.get<string>('THROTTLE_ENABLED') === 'true';

                if (!throttleEnabled) {
                    return { throttlers: [] };
                }

                const redisHost = configService.get<string>('REDIS_DOMAIN') ?? 'localhost';
                const redisPort = parseInt(configService.get<string>('REDIS_PORT') ?? '6379', 10);

                return {
                    throttlers: [
                        {
                            name: 'short',
                            ttl: seconds(parseInt(configService.get<string>('THROTTLE_SHORT_TTL') ?? '1000', 10) / 1000),
                            limit: parseInt(configService.get<string>('THROTTLE_SHORT_LIMIT') ?? '3', 10),
                        },
                        {
                            name: 'medium',
                            ttl: seconds(parseInt(configService.get<string>('THROTTLE_MEDIUM_TTL') ?? '10000', 10) / 1000),
                            limit: parseInt(configService.get<string>('THROTTLE_MEDIUM_LIMIT') ?? '20', 10),
                        },
                        {
                            name: 'long',
                            ttl: seconds(parseInt(configService.get<string>('THROTTLE_LONG_TTL') ?? '60000', 10) / 1000),
                            limit: parseInt(configService.get<string>('THROTTLE_LONG_LIMIT') ?? '100', 10),
                        },
                    ],
                    storage: new ThrottlerStorageRedisService(new Redis({ host: redisHost, port: redisPort })),
                };
            },
            inject: [ConfigService],
        }),
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class ThrottlerModule {}
