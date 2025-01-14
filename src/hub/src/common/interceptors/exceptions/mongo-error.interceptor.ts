import { BadRequestException, ExecutionContext, Injectable } from '@nestjs/common';
import { ExceptionInterceptor } from 'common/interceptors/exceptions/exception.interceptor';
import { MongooseError } from 'mongoose';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class MongoErrorInterceptor extends ExceptionInterceptor<MongooseError> {
    protected getExceptionType(): new (...args: Array<unknown>) => MongooseError {
        return MongooseError;
    }

    protected handleException(exception: MongooseError, context: ExecutionContext): void | never {
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
