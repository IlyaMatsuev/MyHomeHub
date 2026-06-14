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
            // Custom validation exceptions already carry the `messages`/`details` shape — pass them through.
            if ('message' in exceptionResponse) {
                return this.normalizeMessages(exceptionResponse.message as string | Array<string>);
            }
            return exceptionResponse;
        }

        return this.normalizeMessages(exceptionResponse);
    }

    private normalizeMessages(message: string | Array<string>): object {
        const messages = Array.isArray(message) ? message : [message];
        return {
            messages,
            details: { errors: messages.map(singleMessage => ({ message: singleMessage })) },
        };
    }
}
