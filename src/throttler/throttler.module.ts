import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule as NestThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerConfigFactory } from 'throttler/throttler-config.factory';

@Module({
    imports: [NestThrottlerModule.forRootAsync({ useClass: ThrottlerConfigFactory })],
    providers: [
        ThrottlerConfigFactory,
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class ThrottlerModule {}
