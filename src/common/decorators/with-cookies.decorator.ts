import { applyDecorators, SetMetadata, Type, UseInterceptors } from '@nestjs/common';
import { CookiesInterceptor } from 'common/interceptors';

export const WITH_COOKIES_KEY = 'withCookies';

export interface WithCookiesMetadata {
    fields: Array<string>;
}

export function WithCookies<T>(_dto: Type<T>, ...fields: Array<keyof T & string>) {
    return applyDecorators(SetMetadata<string, WithCookiesMetadata>(WITH_COOKIES_KEY, { fields }), UseInterceptors(CookiesInterceptor));
}
