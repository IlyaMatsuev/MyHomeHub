import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from 'common/filters';
import { GlobalInterceptor } from 'common/interceptors';
import { ConditionsEvaluatorService } from 'common/services';

@Global()
@Module({
    providers: [
        ConditionsEvaluatorService,
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: GlobalInterceptor },
    ],
    exports: [ConditionsEvaluatorService],
})
export class CommonModule {}
