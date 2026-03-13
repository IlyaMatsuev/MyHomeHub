import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Error as MongooseError } from 'mongoose';
import { MongoErrorExceptionHandler } from './mongo-error.exception.handler';

describe('MongoErrorExceptionHandler', () => {
    let handler: MongoErrorExceptionHandler;

    beforeEach(() => {
        handler = new MongoErrorExceptionHandler();
    });

    describe('getExceptionType', () => {
        it('should return MongooseError', () => {
            const ExceptionType = handler.getExceptionType();
            expect(ExceptionType.name).toBe('MongooseError');
        });
    });

    describe('handleException', () => {
        const createValidationError = () => {
            const error = new MongooseError.ValidationError();
            error.errors = {
                email: {
                    message: 'Invalid email format',
                    value: 'bad-email',
                } as MongooseError.ValidatorError,
                password: {
                    message: 'Password too short',
                    value: '123',
                } as MongooseError.ValidatorError,
            };
            return error;
        };

        it('should throw BadRequestException for http context with ValidationError', () => {
            const mockContext = {
                getType: jest.fn().mockReturnValue('http'),
            } as unknown as ExecutionContext;
            const exception = createValidationError();

            expect(() => handler.handleException(exception, mockContext)).toThrow(BadRequestException);
        });

        it('should throw WsException for ws context with ValidationError', () => {
            const mockContext = {
                getType: jest.fn().mockReturnValue('ws'),
            } as unknown as ExecutionContext;
            const exception = createValidationError();

            expect(() => handler.handleException(exception, mockContext)).toThrow(WsException);
        });

        it('should not throw for other context types', () => {
            const mockContext = {
                getType: jest.fn().mockReturnValue('rpc'),
            } as unknown as ExecutionContext;
            const exception = createValidationError();

            expect(() => handler.handleException(exception, mockContext)).not.toThrow();
        });

        it('should not throw for non-ValidationError', () => {
            const mockContext = {
                getType: jest.fn().mockReturnValue('http'),
            } as unknown as ExecutionContext;
            const exception = new MongooseError('Generic error');

            expect(() => handler.handleException(exception, mockContext)).not.toThrow();
        });

        it('should include all error messages in BadRequestException', () => {
            const mockContext = {
                getType: jest.fn().mockReturnValue('http'),
            } as unknown as ExecutionContext;
            const exception = createValidationError();

            try {
                handler.handleException(exception, mockContext);
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException);
                const response = (error as BadRequestException).getResponse() as { messages: Array<string> };
                expect(response.messages).toContain('Invalid email format');
                expect(response.messages).toContain('Password too short');
            }
        });
    });

    describe('collectValidationErrors', () => {
        it('should collect all validation errors', () => {
            const error = new MongooseError.ValidationError();
            error.errors = {
                field1: {
                    message: 'Error 1',
                    value: 'value1',
                } as MongooseError.ValidatorError,
                field2: {
                    message: 'Error 2',
                    value: 'value2',
                } as MongooseError.ValidatorError,
            };

            const result = handler.collectValidationErrors(error);

            expect(result).toHaveLength(2);
            expect(result).toContainEqual({ path: 'field1', message: 'Error 1', value: 'value1' });
            expect(result).toContainEqual({ path: 'field2', message: 'Error 2', value: 'value2' });
        });

        it('should return empty array when no errors', () => {
            const error = new MongooseError.ValidationError();
            error.errors = {};

            const result = handler.collectValidationErrors(error);

            expect(result).toEqual([]);
        });
    });
});
