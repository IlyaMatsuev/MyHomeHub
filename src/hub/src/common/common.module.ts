import { Module } from '@nestjs/common';
import { HttpExceptionFilter } from 'common/http-exception.filter';
import { WsExceptionFilter } from 'common/ws-exception.filter';
import { APP_FILTER } from '@nestjs/core';

@Module({
    providers: [
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_FILTER, useClass: WsExceptionFilter },
    ]
})
export class CommonModule {}
