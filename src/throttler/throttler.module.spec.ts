jest.mock('ioredis', () => {
    const MockRedis = function () {
        this.on = jest.fn();
        this.quit = jest.fn();
        this.options = { keyPrefix: '' };
    };
    return {
        __esModule: true,
        default: MockRedis,
        Redis: MockRedis,
        Cluster: MockRedis,
    };
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from './throttler.module';

describe('ThrottlerModule', () => {
    describe('when throttle is enabled', () => {
        let module: TestingModule;

        beforeEach(async () => {
            module = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        isGlobal: true,
                        load: [
                            () => ({
                                THROTTLE_ENABLED: 'true',
                                REDIS_DOMAIN: 'localhost',
                                REDIS_PORT: '6379',
                                THROTTLE_SHORT_TTL_SEC: '1000',
                                THROTTLE_SHORT_LIMIT: '3',
                                THROTTLE_MEDIUM_TTL_SEC: '10000',
                                THROTTLE_MEDIUM_LIMIT: '20',
                                THROTTLE_LONG_TTL_SEC: '60000',
                                THROTTLE_LONG_LIMIT: '100',
                            }),
                        ],
                    }),
                    ThrottlerModule,
                ],
            }).compile();
        });

        afterEach(async () => {
            await module?.close();
        });

        it('should compile the module', () => {
            expect(module).toBeDefined();
        });
    });

    describe('when throttle is disabled', () => {
        let module: TestingModule;

        beforeEach(async () => {
            module = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        isGlobal: true,
                        load: [
                            () => ({
                                THROTTLE_ENABLED: 'false',
                            }),
                        ],
                    }),
                    ThrottlerModule,
                ],
            }).compile();
        });

        afterEach(async () => {
            await module?.close();
        });

        it('should compile the module', () => {
            expect(module).toBeDefined();
        });
    });

    describe('with default configuration values', () => {
        let module: TestingModule;

        beforeEach(async () => {
            module = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        isGlobal: true,
                        load: [
                            () => ({
                                THROTTLE_ENABLED: 'true',
                            }),
                        ],
                    }),
                    ThrottlerModule,
                ],
            }).compile();
        });

        afterEach(async () => {
            await module?.close();
        });

        it('should compile the module with defaults', () => {
            expect(module).toBeDefined();
        });
    });
});
