import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { Observable, of, throwError, firstValueFrom } from 'rxjs';
import { GlobalInterceptor } from './global.interceptor';

describe('GlobalInterceptor', () => {
    let interceptor: GlobalInterceptor;
    let mockExecutionContext: ExecutionContext;
    let mockCallHandler: CallHandler;
    let debugSpy: jest.SpyInstance;

    const mockRequest = { method: 'GET', originalUrl: '/devices', ip: '127.0.0.1' };

    beforeEach(() => {
        interceptor = new GlobalInterceptor();
        mockExecutionContext = {
            getType: jest.fn().mockReturnValue('http'),
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue(mockRequest),
                getResponse: jest.fn(),
            }),
        } as unknown as ExecutionContext;
        debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('intercept', () => {
        it('should pass through response when no internal fields', async () => {
            const responseData = { name: 'Test', value: 123 };
            mockCallHandler = {
                handle: () => of(responseData),
            };

            const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler) as Observable<object>;
            const result = await firstValueFrom(result$);

            expect(result).toEqual(responseData);
        });

        it('should remove _id and __v fields from response', async () => {
            const responseData = { name: 'Test', _id: 'mongo-id', __v: 0 };
            mockCallHandler = {
                handle: () => of(responseData),
            };

            const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler) as Observable<object>;
            const result = await firstValueFrom(result$);

            expect(result).not.toHaveProperty('_id');
            expect(result).not.toHaveProperty('__v');
            expect(result).toHaveProperty('name', 'Test');
        });

        it('should handle errors and rethrow', async () => {
            const testError = new Error('Test error');
            mockCallHandler = {
                handle: () => throwError(() => testError),
            };

            const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler) as Observable<object>;

            await expect(firstValueFrom(result$)).rejects.toThrow(testError);
        });

        it('should log the request method, url, and ip for http context', async () => {
            mockCallHandler = { handle: () => of({}) };

            const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler) as Observable<object>;
            await firstValueFrom(result$);

            expect(debugSpy).toHaveBeenCalledTimes(1);
            expect(debugSpy).toHaveBeenCalledWith('GET /devices from "127.0.0.1"');
        });

        it('should not log or read the http request when context is not http', async () => {
            (mockExecutionContext.getType as jest.Mock).mockReturnValue('rpc');
            mockCallHandler = { handle: () => of({}) };

            const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler) as Observable<object>;
            await firstValueFrom(result$);

            expect(debugSpy).not.toHaveBeenCalled();
            expect(mockExecutionContext.switchToHttp).not.toHaveBeenCalled();
        });
    });

    describe('removeInternalFields', () => {
        it('should return null/undefined as is', () => {
            expect(interceptor.removeInternalFields(null as never)).toBeNull();
            expect(interceptor.removeInternalFields(undefined as never)).toBeUndefined();
        });

        it('should remove internal fields from object', () => {
            const data = { name: 'Test', _id: 'mongo-id', __v: 0 };

            const result = interceptor.removeInternalFields(data);

            expect(result).not.toHaveProperty('_id');
            expect(result).not.toHaveProperty('__v');
            expect(result).toHaveProperty('name', 'Test');
        });

        it('should handle arrays', () => {
            const data = [
                { name: 'Item1', _id: 'id1', __v: 0 },
                { name: 'Item2', _id: 'id2', __v: 1 },
            ];

            const result = interceptor.removeInternalFields(data);

            expect(result).toHaveLength(2);
            result.forEach(item => {
                expect(item).not.toHaveProperty('_id');
                expect(item).not.toHaveProperty('__v');
            });
        });

        it('should handle nested objects', () => {
            const data = {
                name: 'Parent',
                _id: 'parent-id',
                child: {
                    name: 'Child',
                    _id: 'child-id',
                    __v: 0,
                },
            };

            const result = interceptor.removeInternalFields(data);

            expect(result).not.toHaveProperty('_id');
            expect(result.child).not.toHaveProperty('_id');
            expect(result.child).not.toHaveProperty('__v');
        });

        it('should handle Mongoose documents with _doc field', () => {
            const data = {
                _doc: {
                    name: 'Test',
                    _id: 'mongo-id',
                    __v: 0,
                },
            } as unknown as { name: string };

            const result = interceptor.removeInternalFields(data);

            expect(result).toBeDefined();
        });
    });

    describe('handleException', () => {
        it('should rethrow error after processing handlers', () => {
            const testError = new Error('Test error');

            expect(() => interceptor.handleException(testError, mockExecutionContext)).toThrow(testError);
        });
    });
});
