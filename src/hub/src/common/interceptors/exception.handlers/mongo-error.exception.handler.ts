import { MongooseError } from 'mongoose';
import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ExceptionHandler } from 'common/interceptors/interfaces';

export class MongoErrorExceptionHandler implements ExceptionHandler<MongooseError> {
    getExceptionType(): new (...args: Array<unknown>) => MongooseError {
        return MongooseError;
    }

    // TODO: Add more details about what fields caused an error
    handleException(exception: MongooseError, context: ExecutionContext): void | never {
        if (exception.name === 'ValidationError') {
            if (context.getType() === 'http') {
                throw new BadRequestException(exception.message);
            }
            if (context.getType() === 'ws') {
                throw new WsException(exception.message);
            }
        }
    }
}
