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

        it('should convert Date fields to numeric timestamps', async () => {
            const createdAt = new Date('2026-01-01T00:00:00.000Z');
            const updatedAt = new Date('2026-02-01T00:00:00.000Z');
            const responseData = { name: 'Test', createdAt, updatedAt };
            mockCallHandler = {
                handle: () => of(responseData),
            };

            const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler) as Observable<object>;
            const result = (await firstValueFrom(result$)) as { name: string; createdAt: number; updatedAt: number };

            expect(result.createdAt).toBe(Math.floor(createdAt.getTime() / 1000));
            expect(result.updatedAt).toBe(Math.floor(updatedAt.getTime() / 1000));
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

    describe('transformResponse', () => {
        it('should return null/undefined as is', () => {
            expect(interceptor.transformResponse(null as never)).toBeNull();
            expect(interceptor.transformResponse(undefined as never)).toBeUndefined();
        });

        it('should return a top-level Date as numeric timestamp', () => {
            const date = new Date('2026-03-15T12:00:00.000Z');

            const result = interceptor.transformResponse(date as unknown as object);

            expect(result).toBe(Math.floor(date.getTime() / 1000));
        });

        it('should return primitives unchanged', () => {
            expect(interceptor.transformResponse('hello' as unknown as object)).toBe('hello');
            expect(interceptor.transformResponse(42 as unknown as object)).toBe(42);
            expect(interceptor.transformResponse(true as unknown as object)).toBe(true);
        });

        it('should remove internal fields from object', () => {
            const data = { name: 'Test', _id: 'mongo-id', __v: 0 };

            const result = interceptor.transformResponse(data);

            expect(result).not.toHaveProperty('_id');
            expect(result).not.toHaveProperty('__v');
            expect(result).toHaveProperty('name', 'Test');
        });

        it('should convert Date fields to timestamps in object', () => {
            const createdAt = new Date('2026-01-01T00:00:00.000Z');
            const data = { name: 'Test', createdAt };

            const result = interceptor.transformResponse(data) as unknown as { name: string; createdAt: number };

            expect(result.createdAt).toBe(Math.floor(createdAt.getTime() / 1000));
        });

        it('should handle arrays', () => {
            const data = [
                { name: 'Item1', _id: 'id1', __v: 0 },
                { name: 'Item2', _id: 'id2', __v: 1 },
            ];

            const result = interceptor.transformResponse(data);

            expect(result).toHaveLength(2);
            result.forEach(item => {
                expect(item).not.toHaveProperty('_id');
                expect(item).not.toHaveProperty('__v');
            });
        });

        it('should convert Date elements inside arrays to timestamps', () => {
            const first = new Date('2026-01-01T00:00:00.000Z');
            const second = new Date('2026-02-01T00:00:00.000Z');
            const data: Array<unknown> = [first, second];

            const result = interceptor.transformResponse(data);

            expect(result[0]).toBe(Math.floor(first.getTime() / 1000));
            expect(result[1]).toBe(Math.floor(second.getTime() / 1000));
        });

        it('should convert Date fields inside array items', () => {
            const createdAt = new Date('2026-01-01T00:00:00.000Z');
            const data = [{ name: 'Item', createdAt }];

            const result = interceptor.transformResponse(data) as unknown as Array<{ name: string; createdAt: number }>;

            expect(result[0].createdAt).toBe(Math.floor(createdAt.getTime() / 1000));
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

            const result = interceptor.transformResponse(data);

            expect(result).not.toHaveProperty('_id');
            expect(result.child).not.toHaveProperty('_id');
            expect(result.child).not.toHaveProperty('__v');
        });

        it('should convert nested Date fields to timestamps', () => {
            const childCreatedAt = new Date('2026-04-01T00:00:00.000Z');
            const data = {
                name: 'Parent',
                child: { name: 'Child', createdAt: childCreatedAt },
            };

            const result = interceptor.transformResponse(data) as unknown as {
                name: string;
                child: { name: string; createdAt: number };
            };

            expect(result.child.createdAt).toBe(Math.floor(childCreatedAt.getTime() / 1000));
        });

        it('should handle Mongoose documents with _doc field', () => {
            const createdAt = new Date('2026-05-01T00:00:00.000Z');
            const data = {
                _doc: {
                    name: 'Test',
                    _id: 'mongo-id',
                    __v: 0,
                    createdAt,
                },
            } as unknown as { _doc: { name: string; createdAt: number } };

            const result = interceptor.transformResponse(data);

            expect(result).toBeDefined();
            expect(result._doc).not.toHaveProperty('_id');
            expect(result._doc).not.toHaveProperty('__v');
            expect(result._doc.createdAt).toBe(Math.floor(createdAt.getTime() / 1000));
        });
    });
});
