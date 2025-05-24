import { ExceptionHandler } from 'common/interfaces';
import { MongoErrorExceptionHandler } from 'common/interceptors/exception.handlers/mongo-error.exception.handler';
import { CustomValidationExceptionHandler } from 'common/interceptors/exception.handlers/custom-validation.exception.handler';

export const exceptionHandlers: Array<new () => ExceptionHandler<Error>> = [MongoErrorExceptionHandler, CustomValidationExceptionHandler];
