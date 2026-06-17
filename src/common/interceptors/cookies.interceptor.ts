import { Reflector } from '@nestjs/core';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { WITH_COOKIES_KEY, WithCookiesMetadata } from 'common/decorators';
import { Response } from 'express';
import { CookiesConfigService } from 'common/services';

@Injectable()
export class CookiesInterceptor implements NestInterceptor {
    constructor(
        private readonly cookiesConfig: CookiesConfigService,
        private readonly reflector: Reflector,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const meta = this.reflector.get<WithCookiesMetadata>(WITH_COOKIES_KEY, context.getHandler());
        if (!meta) {
            return next.handle();
        }

        const response = context.switchToHttp().getResponse<Response>();
        return next.handle().pipe(
            map((body: Record<string, unknown>) => {
                for (const field of meta.fields) {
                    const value = body?.[field];
                    if (typeof value === 'string') {
                        response.cookie(field, value, this.cookiesConfig.get(field));
                    }
                }
                return body;
            }),
        );
    }
}
