import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, map, Observable } from 'rxjs';
import { Request } from 'express';
import { exceptionHandlers } from 'common/interceptors/exception.handlers';

const EXCLUDED_INTERNAL_FIELDS = ['_id', '__v'];

@Injectable()
export class GlobalInterceptor implements NestInterceptor {
    private readonly logger = new Logger(GlobalInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<object> | Promise<Observable<object>> {
        if (context.getType() === 'http') {
            const req = context.switchToHttp().getRequest<Request>();
            this.logger.debug(`${req.method} ${req.originalUrl} from "${req.ip}"`);
        }

        return next.handle().pipe(
            map(response => this.transformResponse(response)),
            catchError((error: Error) => this.handleException(error, context)),
        );
    }

    transformResponse<T extends object>(data: T): T {
        if (!data) {
            return data;
        }
        if (data instanceof Date) {
            return this.transformDate(data);
        }
        if (Array.isArray(data)) {
            data.forEach((item, index) => (data[index] = this.transformResponse(item)));
            return data;
        }
        if (typeof data !== 'object') {
            return data;
        }

        const objectData = data as Record<string, unknown>;
        const documentData: Record<string, unknown> = '_doc' in objectData ? (objectData._doc as Record<string, unknown>) : objectData;

        Object.keys(documentData).forEach(key => {
            const value = documentData[key];
            if (value instanceof Date) {
                documentData[key] = this.transformDate<number>(value);
            } else if (value && typeof value === 'object') {
                documentData[key] = this.transformResponse(value);
            }
        });

        EXCLUDED_INTERNAL_FIELDS.forEach(f => {
            if (f in documentData) {
                delete documentData[f];
            }
        });
        return data;
    }

    private transformDate<T>(value: Date): T {
        return Math.floor(value.getTime() / 1000) as unknown as T;
    }

    private handleException(error: Error, context: ExecutionContext): never {
        exceptionHandlers.forEach(Handler => {
            const handler = new Handler();
            if (error instanceof handler.getExceptionType()) {
                handler.handleException(error, context);
            }
        });
        throw error;
    }
}
