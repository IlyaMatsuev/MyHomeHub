import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus();

        response.status(status).json({
            ...this.buildResponseBody(exception),
            statusCode: status,
        });
    }

    private buildResponseBody(exception: HttpException): object {
        const exceptionResponse = exception.getResponse();
        if (typeof exceptionResponse === 'object') {
            if ('message' in exceptionResponse && Array.isArray(exceptionResponse.message)) {
                return { messages: exceptionResponse.message, ...exceptionResponse, message: undefined };
            }
            return exceptionResponse;
        }
        return { messages: [exceptionResponse] };
    }
}
