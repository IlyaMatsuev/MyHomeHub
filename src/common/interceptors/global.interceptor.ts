import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, map, Observable } from 'rxjs';
import { Request } from 'express';
import { exceptionHandlers } from 'common/interceptors/exception.handlers';

const EXCLUDED_INTERNAL_FIELDS = ['_id', '__v'];

@Injectable()
export class GlobalInterceptor implements NestInterceptor {
    private readonly logger = new Logger(GlobalInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> | Promise<Observable<unknown>> {
        if (context.getType() === 'http') {
            const req = context.switchToHttp().getRequest<Request>();
            this.logger.debug(`${req.method} ${req.originalUrl} from "${req.ip}"`);
        }

        return next.handle().pipe(
            map(response => this.transformResponse(response)),
            catchError((error: Error) => this.handleException(error, context)),
        );
    }

    transformResponse<T>(data: T): T {
        if (data === null || data === undefined) {
            return data;
        }
        if (data instanceof Date) {
            return data.getTime() as unknown as T;
        }
        if (Array.isArray(data)) {
            data.forEach((item, index) => {
                data[index] = this.transformResponse(item);
            });
            return data;
        }
        if (typeof data !== 'object') {
            return data;
        }
        const objectData = data as Record<string, unknown>;
        const rawData: Record<string, unknown> = '_doc' in objectData ? (objectData._doc as Record<string, unknown>) : objectData;
        Object.keys(rawData).forEach(key => {
            const value = rawData[key];
            if (value instanceof Date) {
                rawData[key] = value.getTime();
            } else if (value && typeof value === 'object') {
                rawData[key] = this.transformResponse(value);
            }
        });

        EXCLUDED_INTERNAL_FIELDS.forEach(f => {
            if (f in rawData) {
                delete rawData[f];
            }
        });
        return data;
    }

    handleException(error: Error, context: ExecutionContext): never {
        exceptionHandlers.forEach(Handler => {
            const handler = new Handler();
            if (error instanceof handler.getExceptionType()) {
                handler.handleException(error, context);
            }
        });
        throw error;
    }
}
