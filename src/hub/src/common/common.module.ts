import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter, WsExceptionFilter } from 'common/filters';
import { GlobalInterceptor } from 'common/interceptors';
import { ConditionsEvaluatorService } from 'common/services/conditions-evaluator.service';

@Module({
    providers: [
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_FILTER, useClass: WsExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: GlobalInterceptor },
        ConditionsEvaluatorService,
    ],
    exports: [ConditionsEvaluatorService],
})
export class CommonModule {}
