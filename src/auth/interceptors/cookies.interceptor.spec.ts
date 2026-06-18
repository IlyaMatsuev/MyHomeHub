import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable, firstValueFrom, of } from 'rxjs';
import { WITH_COOKIES_KEY, WithCookiesMetadata } from 'auth/decorators';
import { CookiesConfigService } from 'auth/cookies-config.service';
import { CookiesInterceptor } from './cookies.interceptor';

describe('CookiesInterceptor', () => {
    let interceptor: CookiesInterceptor;
    let mockReflector: { get: jest.Mock };
    let mockCookiesConfig: { get: jest.Mock };
    let mockResponse: { cookie: jest.Mock };
    let mockExecutionContext: ExecutionContext;
    let handler: () => unknown;

    const buildHandler = (body: unknown): CallHandler => ({
        handle: () => of(body) as Observable<unknown>,
    });

    beforeEach(() => {
        mockReflector = { get: jest.fn() };
        mockCookiesConfig = { get: jest.fn() };
        mockResponse = { cookie: jest.fn() };
        handler = () => undefined;

        mockExecutionContext = {
            getHandler: () => handler,
            switchToHttp: () => ({
                getResponse: () => mockResponse as unknown as Response,
                getRequest: jest.fn(),
                getNext: jest.fn(),
            }),
        } as unknown as ExecutionContext;

        interceptor = new CookiesInterceptor(mockCookiesConfig as unknown as CookiesConfigService, mockReflector as unknown as Reflector);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should pass through the response untouched when no metadata is attached', async () => {
        mockReflector.get.mockReturnValue(undefined);
        const body = { accessToken: 'jwt-token' };

        const result$ = interceptor.intercept(mockExecutionContext, buildHandler(body));
        const result = await firstValueFrom(result$);

        expect(result).toEqual(body);
        expect(mockResponse.cookie).not.toHaveBeenCalled();
        expect(mockReflector.get).toHaveBeenCalledWith(WITH_COOKIES_KEY, handler);
    });

    it('should set cookies for every metadata field that is a string in the body', async () => {
        const meta: WithCookiesMetadata = { fields: ['accessToken', 'refreshToken'] };
        mockReflector.get.mockReturnValue(meta);
        mockCookiesConfig.get.mockImplementation((name: string) => ({ httpOnly: true, path: name }));
        const body = { accessToken: 'jwt-token', refreshToken: 'refresh-token' };

        const result$ = interceptor.intercept(mockExecutionContext, buildHandler(body));
        const result = await firstValueFrom(result$);

        expect(result).toEqual(body);
        expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
        expect(mockResponse.cookie).toHaveBeenNthCalledWith(1, 'accessToken', 'jwt-token', { httpOnly: true, path: 'accessToken' });
        expect(mockResponse.cookie).toHaveBeenNthCalledWith(2, 'refreshToken', 'refresh-token', { httpOnly: true, path: 'refreshToken' });
    });

    it('should resolve cookie options through CookiesConfigService for each field', async () => {
        mockReflector.get.mockReturnValue({ fields: ['accessToken'] } as WithCookiesMetadata);
        mockCookiesConfig.get.mockReturnValue({ httpOnly: true });

        const result$ = interceptor.intercept(mockExecutionContext, buildHandler({ accessToken: 'jwt-token' }));
        await firstValueFrom(result$);

        expect(mockCookiesConfig.get).toHaveBeenCalledWith('accessToken');
    });

    it('should skip metadata fields that are missing from the body', async () => {
        mockReflector.get.mockReturnValue({ fields: ['accessToken', 'refreshToken'] } as WithCookiesMetadata);
        mockCookiesConfig.get.mockReturnValue({ httpOnly: true });

        const result$ = interceptor.intercept(mockExecutionContext, buildHandler({ accessToken: 'jwt-token' }));
        await firstValueFrom(result$);

        expect(mockResponse.cookie).toHaveBeenCalledTimes(1);
        expect(mockResponse.cookie).toHaveBeenCalledWith('accessToken', 'jwt-token', { httpOnly: true });
    });

    it('should skip metadata fields whose value is not a string', async () => {
        mockReflector.get.mockReturnValue({ fields: ['accessToken'] } as WithCookiesMetadata);
        mockCookiesConfig.get.mockReturnValue({ httpOnly: true });

        const result$ = interceptor.intercept(mockExecutionContext, buildHandler({ accessToken: 123 }));
        await firstValueFrom(result$);

        expect(mockResponse.cookie).not.toHaveBeenCalled();
    });

    it('should pass through a nullish body without setting cookies', async () => {
        mockReflector.get.mockReturnValue({ fields: ['accessToken'] } as WithCookiesMetadata);

        const result$ = interceptor.intercept(mockExecutionContext, buildHandler(null));
        const result = await firstValueFrom(result$);

        expect(result).toBeNull();
        expect(mockResponse.cookie).not.toHaveBeenCalled();
    });
});
