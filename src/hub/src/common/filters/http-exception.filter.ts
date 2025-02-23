import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus();

        const responseBody =
            typeof exception.getResponse() === 'object' ? (exception.getResponse() as object) : { message: exception.getResponse() };

        response.status(status).json({
            ...responseBody,
            statusCode: status,
        });
    }
}
