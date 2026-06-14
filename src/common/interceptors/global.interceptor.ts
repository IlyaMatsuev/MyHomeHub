import { CallHandler, ExecutionContext, Global, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, map, Observable } from 'rxjs';
import { Request } from 'express';
import { exceptionHandlers } from 'common/interceptors/exception.handlers';

const EXCLUDED_INTERNAL_FIELDS = ['_id', '__v'];

@Global()
@Injectable()
export class GlobalInterceptor implements NestInterceptor {
    private readonly logger = new Logger(GlobalInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<object> | Promise<Observable<object>> {
        if (context.getType() === 'http') {
            const req = context.switchToHttp().getRequest<Request>();
            this.logger.debug(`${req.method} ${req.originalUrl} from "${req.ip}"`);
        }

        return next.handle().pipe(
            map(response => this.removeInternalFields(response)),
            catchError((error: Error) => this.handleException(error, context)),
        );
    }

    removeInternalFields<T extends object>(data: T): T {
        if (!data) {
            return data;
        }
        if (Array.isArray(data)) {
            data.forEach((d: T) => this.removeInternalFields(d));
            return data;
        }
        const rawData: T = '_doc' in data ? (data['_doc'] as T) : data;
        Object.keys(rawData).forEach(key => {
            if (Array.isArray(rawData[key]) || typeof rawData[key] === 'object') {
                this.removeInternalFields(rawData[key]);
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
