import { ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { AuthConfigService } from 'auth/auth-config.service';
import { LocalNetworkGuard } from './local-network.guard';

describe('LocalNetworkGuard', () => {
    let guard: LocalNetworkGuard;
    let mockAuthConfig: { isLocalNetworkOnlyEndpoint: jest.Mock };
    let debugSpy: jest.SpyInstance;

    const createMockContext = (ip?: string, remoteAddress?: string, type = 'http'): ExecutionContext =>
        ({
            getType: jest.fn().mockReturnValue(type),
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({ ip, socket: { remoteAddress }, originalUrl: '/auth/register/requests' }),
            }),
            getHandler: jest.fn(),
            getClass: jest.fn(),
        }) as unknown as ExecutionContext;

    beforeEach(() => {
        debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
        mockAuthConfig = { isLocalNetworkOnlyEndpoint: jest.fn().mockReturnValue(true) };
        guard = new LocalNetworkGuard(mockAuthConfig as unknown as AuthConfigService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        debugSpy.mockRestore();
    });

    it('should allow non-http contexts (e.g. MQTT) without checking the client address', () => {
        expect(guard.canActivate(createMockContext('8.8.8.8', undefined, 'rpc'))).toBe(true);
        expect(mockAuthConfig.isLocalNetworkOnlyEndpoint).not.toHaveBeenCalled();
    });

    it('should allow endpoints that are not restricted to the local network', () => {
        mockAuthConfig.isLocalNetworkOnlyEndpoint.mockReturnValue(false);

        expect(guard.canActivate(createMockContext('8.8.8.8'))).toBe(true);
    });

    it.each([
        ['127.0.0.1'],
        ['10.20.30.40'],
        ['172.16.0.1'],
        ['172.31.255.254'],
        ['192.168.1.15'],
        ['169.254.10.10'],
        ['::1'],
        ['fd00::1'],
        ['fe80::1'],
        ['::ffff:192.168.1.15'],
    ])('should allow the request coming from the local address %s', ip => {
        expect(guard.canActivate(createMockContext(ip))).toBe(true);
    });

    it.each([['8.8.8.8'], ['203.0.113.10'], ['172.32.0.1'], ['100.64.0.1'], ['2001:4860:4860::8888'], ['::ffff:8.8.8.8']])(
        'should reject the request coming from the remote address %s',
        ip => {
            expect(() => guard.canActivate(createMockContext(ip))).toThrow(ForbiddenException);
        },
    );

    it.each([[undefined], [''], ['   '], ['not-an-ip'], ['192.168.1.256']])(
        'should reject the request with the unresolvable address %s',
        ip => {
            expect(() => guard.canActivate(createMockContext(ip))).toThrow(ForbiddenException);
        },
    );

    it('should fall back to the socket remote address when the request IP is not resolved', () => {
        expect(guard.canActivate(createMockContext(undefined, '10.0.0.5'))).toBe(true);
        expect(() => guard.canActivate(createMockContext(undefined, '8.8.8.8'))).toThrow(ForbiddenException);
    });

    it('should log the rejected request on debug', () => {
        expect(() => guard.canActivate(createMockContext('8.8.8.8'))).toThrow(ForbiddenException);
        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('8.8.8.8'));
    });
});
