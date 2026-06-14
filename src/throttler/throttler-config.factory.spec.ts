jest.mock('ioredis', () => {
    const MockRedis = jest.fn(function (opts) {
        this.options = { keyPrefix: '', ...(opts ?? {}) };
        this.on = jest.fn();
        this.quit = jest.fn();
    });
    return {
        __esModule: true,
        default: MockRedis,
        Redis: MockRedis,
        Cluster: MockRedis,
    };
});

import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { seconds } from '@nestjs/throttler';
import { ThrottlerConfigFactory } from './throttler-config.factory';

describe('ThrottlerConfigFactory', () => {
    let warnSpy: jest.SpyInstance;

    const buildFactory = (env: Record<string, string> = {}): ThrottlerConfigFactory => {
        const configService = { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService;
        return new ThrottlerConfigFactory(configService);
    };

    beforeEach(() => {
        warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
        warnSpy.mockRestore();
    });

    describe('createThrottlerOptions', () => {
        it('should return empty throttlers when THROTTLE_ENABLED is "false"', () => {
            const factory = buildFactory({ THROTTLE_ENABLED: 'false' });

            expect(factory.createThrottlerOptions()).toEqual({ throttlers: [] });
        });

        it('should return empty throttlers when THROTTLE_ENABLED is missing', () => {
            const factory = buildFactory({});

            expect(factory.createThrottlerOptions()).toEqual({ throttlers: [] });
        });

        it('should not construct a Redis client when throttling is disabled', () => {
            const factory = buildFactory({ THROTTLE_ENABLED: 'false' });

            factory.createThrottlerOptions();

            expect(Redis).not.toHaveBeenCalled();
        });

        it('should build a throttler definition for each preset when env vars are provided', () => {
            const factory = buildFactory({
                THROTTLE_ENABLED: 'true',
                REDIS_DOMAIN: 'localhost',
                REDIS_PORT: '6379',
                THROTTLE_SHORT_TTL_SEC: '1',
                THROTTLE_SHORT_LIMIT: '3',
                THROTTLE_MEDIUM_TTL_SEC: '10',
                THROTTLE_MEDIUM_LIMIT: '20',
                THROTTLE_LONG_TTL_SEC: '60',
                THROTTLE_LONG_LIMIT: '100',
            });

            const options = factory.createThrottlerOptions();

            expect(options).toMatchObject({
                throttlers: [
                    { name: 'short', ttl: seconds(1), limit: 3 },
                    { name: 'medium', ttl: seconds(10), limit: 20 },
                    { name: 'long', ttl: seconds(60), limit: 100 },
                ],
            });
            expect((options as { storage: unknown }).storage).toBeDefined();
        });

        it('should drop a definition when its TTL env var is missing', () => {
            const factory = buildFactory({
                THROTTLE_ENABLED: 'true',
                REDIS_DOMAIN: 'localhost',
                REDIS_PORT: '6379',
                THROTTLE_SHORT_LIMIT: '3',
                THROTTLE_MEDIUM_TTL_SEC: '10',
                THROTTLE_MEDIUM_LIMIT: '20',
            });

            const options = factory.createThrottlerOptions();

            expect(options).toMatchObject({
                throttlers: [{ name: 'medium', ttl: seconds(10), limit: 20 }],
            });
        });

        it('should drop a definition when its LIMIT env var is missing', () => {
            const factory = buildFactory({
                THROTTLE_ENABLED: 'true',
                REDIS_DOMAIN: 'localhost',
                REDIS_PORT: '6379',
                THROTTLE_SHORT_TTL_SEC: '1',
                THROTTLE_MEDIUM_TTL_SEC: '10',
                THROTTLE_MEDIUM_LIMIT: '20',
            });

            const options = factory.createThrottlerOptions();

            expect(options).toMatchObject({
                throttlers: [{ name: 'medium', ttl: seconds(10), limit: 20 }],
            });
        });

        it('should drop a definition when its TTL env var is not a number', () => {
            const factory = buildFactory({
                THROTTLE_ENABLED: 'true',
                REDIS_DOMAIN: 'localhost',
                REDIS_PORT: '6379',
                THROTTLE_SHORT_TTL_SEC: 'not-a-number',
                THROTTLE_SHORT_LIMIT: '3',
            });

            const options = factory.createThrottlerOptions();

            expect(options).toMatchObject({ throttlers: [] });
        });

        it('should return empty throttlers but still configure storage when no preset env vars are set', () => {
            const factory = buildFactory({
                THROTTLE_ENABLED: 'true',
                REDIS_DOMAIN: 'localhost',
                REDIS_PORT: '6379',
            });

            const options = factory.createThrottlerOptions();

            expect(options).toMatchObject({ throttlers: [] });
            expect((options as { storage: unknown }).storage).toBeDefined();
        });

        it('should log a warning when enabled but no preset env vars are set', () => {
            const factory = buildFactory({
                THROTTLE_ENABLED: 'true',
                REDIS_DOMAIN: 'localhost',
                REDIS_PORT: '6379',
            });

            factory.createThrottlerOptions();

            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Throttler rate limiter is enabled'));
        });

        it('should not log the empty-config warning when at least one preset is configured', () => {
            const factory = buildFactory({
                THROTTLE_ENABLED: 'true',
                REDIS_DOMAIN: 'localhost',
                REDIS_PORT: '6379',
                THROTTLE_SHORT_TTL_SEC: '1',
                THROTTLE_SHORT_LIMIT: '3',
            });

            factory.createThrottlerOptions();

            expect(warnSpy).not.toHaveBeenCalled();
        });

        it('should construct the Redis client using REDIS_DOMAIN and REDIS_PORT', () => {
            const factory = buildFactory({
                THROTTLE_ENABLED: 'true',
                REDIS_DOMAIN: 'redis.local',
                REDIS_PORT: '6380',
                THROTTLE_SHORT_TTL_SEC: '1',
                THROTTLE_SHORT_LIMIT: '3',
            });

            factory.createThrottlerOptions();

            expect(Redis).toHaveBeenCalledTimes(1);
            expect(Redis).toHaveBeenCalledWith({ host: 'redis.local', port: 6380 });
        });
    });
});
