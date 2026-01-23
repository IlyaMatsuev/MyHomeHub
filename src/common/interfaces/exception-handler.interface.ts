import { ExecutionContext } from '@nestjs/common';

export interface ExceptionHandler<T extends Error> {
    getExceptionType(): new (...args: Array<unknown>) => T;
    handleException(exception: T, context: ExecutionContext): void | never;
}
