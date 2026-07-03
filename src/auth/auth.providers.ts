import Redis from 'ioredis';
import { AuthConfigService } from 'auth/auth-config.service';
import { PASSWORD_RESET_REDIS_CLIENT } from 'auth/auth.constants';

export const authProviders = [
    {
        provide: PASSWORD_RESET_REDIS_CLIENT,
        useFactory: (authConfig: AuthConfigService): Redis =>
            new Redis({
                keyPrefix: authConfig.getRedisKeyPrefix(),
                host: authConfig.getRedisHost(),
                port: authConfig.getRedisPort(),
                lazyConnect: true,
            }),
        inject: [AuthConfigService],
    },
];
