import { MongooseError, Error } from 'mongoose';
import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ExceptionHandler, ValidationError } from 'common/interceptors/interfaces';

export class MongoErrorExceptionHandler implements ExceptionHandler<MongooseError> {
    getExceptionType(): new (...args: Array<unknown>) => MongooseError {
        return MongooseError;
    }

    handleException(exception: MongooseError, context: ExecutionContext): void | never {
        if (exception.name === 'ValidationError') {
            const allErrors = this.collectValidationErrors(exception as Error.ValidationError);
            if (context.getType() === 'http') {
                throw new BadRequestException({
                    message: allErrors[0].message,
                    details: {
                        errors: allErrors,
                    },
                });
            }
            if (context.getType() === 'ws') {
                throw new WsException(exception.message);
            }
        }
    }

    collectValidationErrors(error: Error.ValidationError): Array<ValidationError> {
        return Object.keys(error.errors).reduce((errorDetails: Array<ValidationError>, errorPath: string) => {
            errorDetails.push({ path: errorPath, message: error.errors[errorPath].message, value: error.errors[errorPath].value });
            return errorDetails;
        }, []);
    }
}
