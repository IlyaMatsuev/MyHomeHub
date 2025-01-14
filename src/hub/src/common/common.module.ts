import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter, WsExceptionFilter } from 'common/filters';
import { MongoErrorInterceptor } from 'common/interceptors';

@Module({
    providers: [
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_FILTER, useClass: WsExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: MongoErrorInterceptor },
    ],
})
export class CommonModule {}
