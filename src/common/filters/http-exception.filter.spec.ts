import { ArgumentsHost, HttpException, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
    let filter: HttpExceptionFilter;
    let mockResponse: {
        status: jest.Mock;
        json: jest.Mock;
    };
    let mockHost: ArgumentsHost;

    beforeEach(() => {
        filter = new HttpExceptionFilter();
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        mockHost = {
            switchToHttp: jest.fn().mockReturnValue({
                getResponse: jest.fn().mockReturnValue(mockResponse),
            }),
        } as unknown as ArgumentsHost;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should handle HttpException with string message', () => {
        const exception = new HttpException('Test error message', 400);

        filter.catch(exception, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
            messages: ['Test error message'],
            statusCode: 400,
        });
    });

    it('should handle HttpException with object response', () => {
        const exception = new HttpException({ error: 'Bad Request', details: 'More info' }, 400);

        filter.catch(exception, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: 'Bad Request',
            details: 'More info',
            statusCode: 400,
        });
    });

    it('should handle HttpException with array message', () => {
        const exception = new BadRequestException({
            message: ['Error 1', 'Error 2'],
            error: 'Bad Request',
        });

        filter.catch(exception, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
            messages: ['Error 1', 'Error 2'],
            message: undefined,
            error: 'Bad Request',
            statusCode: 400,
        });
    });

    it('should preserve status code from exception', () => {
        const exception = new HttpException('Not Found', 404);

        filter.catch(exception, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle 500 Internal Server Error', () => {
        const exception = new HttpException('Internal Server Error', 500);

        filter.catch(exception, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
            messages: ['Internal Server Error'],
            statusCode: 500,
        });
    });
});
