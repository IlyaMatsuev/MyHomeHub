import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { CustomValidationExceptionHandler } from './custom-validation.exception.handler';
import { CustomValidationException } from 'common/exceptions';

describe('CustomValidationExceptionHandler', () => {
    let handler: CustomValidationExceptionHandler;

    beforeEach(() => {
        handler = new CustomValidationExceptionHandler();
    });

    describe('getExceptionType', () => {
        it('should return CustomValidationException', () => {
            expect(handler.getExceptionType()).toBe(CustomValidationException);
        });
    });

    describe('handleException', () => {
        it('should throw BadRequestException for http context', () => {
            const mockContext = {
                getType: jest.fn().mockReturnValue('http'),
            } as unknown as ExecutionContext;
            const exception = new CustomValidationException({ path: 'field', message: 'Invalid field', value: 'bad' });

            expect(() => handler.handleException(exception, mockContext)).toThrow(BadRequestException);
        });

        it('should throw WsException for ws context', () => {
            const mockContext = {
                getType: jest.fn().mockReturnValue('ws'),
            } as unknown as ExecutionContext;
            const exception = new CustomValidationException({ path: 'field', message: 'Invalid field', value: 'bad' });

            expect(() => handler.handleException(exception, mockContext)).toThrow(WsException);
        });

        it('should not throw for other context types', () => {
            const mockContext = {
                getType: jest.fn().mockReturnValue('rpc'),
            } as unknown as ExecutionContext;
            const exception = new CustomValidationException({ path: 'field', message: 'Invalid field', value: 'bad' });

            expect(() => handler.handleException(exception, mockContext)).not.toThrow();
        });

        it('should not throw for non-CustomValidationException name', () => {
            const mockContext = {
                getType: jest.fn().mockReturnValue('http'),
            } as unknown as ExecutionContext;
            const exception = new CustomValidationException({ path: 'field', message: 'Invalid field', value: 'bad' });
            // Modify the name to test the condition
            Object.defineProperty(exception, 'name', { value: 'OtherException' });

            expect(() => handler.handleException(exception, mockContext)).not.toThrow();
        });

        it('should include messages and errors in BadRequestException', () => {
            const mockContext = {
                getType: jest.fn().mockReturnValue('http'),
            } as unknown as ExecutionContext;
            const error1 = { path: 'email', message: 'Invalid email', value: 'bad-email' };
            const error2 = { path: 'password', message: 'Too short', value: '123' };
            const exception = new CustomValidationException(error1, error2);

            try {
                handler.handleException(exception, mockContext);
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException);
                const response = (error as BadRequestException).getResponse() as {
                    messages: Array<string>;
                    details: { errors: Array<unknown> };
                };
                expect(response.messages).toEqual(['Invalid email', 'Too short']);
                expect(response.details.errors).toEqual([error1, error2]);
            }
        });
    });
});
