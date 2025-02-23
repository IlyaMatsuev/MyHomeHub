import { ExceptionHandler } from 'common/interceptors/interfaces';
import { MongoErrorExceptionHandler } from 'common/interceptors/exception.handlers/mongo-error.exception.handler';

export const exceptionHandlers: Array<new () => ExceptionHandler<Error>> = [MongoErrorExceptionHandler];
