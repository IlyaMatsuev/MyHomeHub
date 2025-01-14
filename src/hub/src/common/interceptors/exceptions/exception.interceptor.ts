import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { catchError, Observable } from 'rxjs';

export abstract class ExceptionInterceptor<T> implements NestInterceptor {
    protected abstract getExceptionType(): new (...args: Array<unknown>) => T;
    protected abstract handleException(exception: Error, context: ExecutionContext): void | never;

    intercept(context: ExecutionContext, next: CallHandler): Observable<object> {
        return next.handle().pipe(
            catchError((error: Error) => {
                if (error instanceof this.getExceptionType()) {
                    this.handleException(error, context);
                }
                throw error;
            }),
        );
    }
}
