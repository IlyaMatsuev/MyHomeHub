import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { LocalNetworkService } from './local-network.service';

describe('LocalNetworkService', () => {
    let warnSpy: jest.SpyInstance;

    const buildService = (env: Record<string, string> = {}): LocalNetworkService => {
        const configService = { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService;
        return new LocalNetworkService(configService);
    };

    const buildRequest = (ip?: string, remoteAddress?: string): Request => ({ ip, socket: { remoteAddress } }) as unknown as Request;

    beforeEach(() => {
        warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
        warnSpy.mockRestore();
    });

    describe('isRestrictionEnabled', () => {
        it('should be enabled by default when the variable is not set', () => {
            expect(buildService().isRestrictionEnabled()).toBe(true);
        });

        it('should be enabled when the variable is "true"', () => {
            expect(buildService({ LOCAL_NETWORK_ONLY_ENABLED: 'true' }).isRestrictionEnabled()).toBe(true);
        });

        it('should be disabled when the variable is "false"', () => {
            expect(buildService({ LOCAL_NETWORK_ONLY_ENABLED: ' false ' }).isRestrictionEnabled()).toBe(false);
        });
    });

    describe('isLocalAddress', () => {
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
        ])('should treat %s as a local address', ip => {
            expect(buildService().isLocalAddress(ip)).toBe(true);
        });

        it.each([['8.8.8.8'], ['203.0.113.10'], ['172.32.0.1'], ['100.64.0.1'], ['2001:4860:4860::8888'], ['::ffff:8.8.8.8']])(
            'should treat %s as a remote address',
            ip => {
                expect(buildService().isLocalAddress(ip)).toBe(false);
            },
        );

        it.each([[undefined], [''], ['   '], ['not-an-ip'], ['192.168.1.256']])('should reject the invalid address %s', ip => {
            expect(buildService().isLocalAddress(ip)).toBe(false);
        });

        it('should accept addresses from the configured extra CIDRs', () => {
            const service = buildService({ LOCAL_NETWORK_ALLOWED_CIDRS: '100.64.0.0/10, 2001:db8::/32' });

            expect(service.isLocalAddress('100.100.20.30')).toBe(true);
            expect(service.isLocalAddress('2001:db8::5')).toBe(true);
            expect(service.isLocalAddress('101.0.0.1')).toBe(false);
        });

        it('should accept a plain address without a prefix in the configured extra CIDRs', () => {
            const service = buildService({ LOCAL_NETWORK_ALLOWED_CIDRS: '203.0.113.10,::ffff:8.8.8.8' });

            expect(service.isLocalAddress('203.0.113.10')).toBe(true);
            expect(service.isLocalAddress('203.0.113.11')).toBe(false);
            expect(service.isLocalAddress('8.8.8.8')).toBe(true);
        });

        it('should not match a CIDR of a different IP version', () => {
            const service = buildService({ LOCAL_NETWORK_ALLOWED_CIDRS: '2001:db8::/32' });

            expect(service.isLocalAddress('203.0.113.10')).toBe(false);
        });

        it('should skip invalid entries in the configured extra CIDRs', () => {
            const service = buildService({ LOCAL_NETWORK_ALLOWED_CIDRS: 'not-a-cidr,,203.0.113.0/24' });

            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not-a-cidr'));
            expect(service.isLocalAddress('203.0.113.10')).toBe(true);
            expect(service.isLocalAddress('8.8.8.8')).toBe(false);
        });
    });

    describe('isLocalRequest', () => {
        it('should resolve the client IP from the request IP', () => {
            expect(buildService().isLocalRequest(buildRequest('192.168.1.15'))).toBe(true);
            expect(buildService().isLocalRequest(buildRequest('8.8.8.8'))).toBe(false);
        });

        it('should fall back to the socket remote address when the request IP is not resolved', () => {
            expect(buildService().isLocalRequest(buildRequest(undefined, '10.0.0.5'))).toBe(true);
            expect(buildService().isLocalRequest(buildRequest(undefined, '8.8.8.8'))).toBe(false);
        });

        it('should reject a request without any resolvable address', () => {
            expect(buildService().isLocalRequest(buildRequest())).toBe(false);
            expect(buildService().isLocalRequest(undefined)).toBe(false);
        });
    });

    describe('onModuleInit', () => {
        it('should warn when the restriction is disabled', () => {
            buildService({ LOCAL_NETWORK_ONLY_ENABLED: 'false' }).onModuleInit();

            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('LOCAL_NETWORK_ONLY_ENABLED'));
        });

        it('should warn when the restriction is enabled together with a blanket TRUST_PROXY', () => {
            buildService({ TRUST_PROXY: 'true' }).onModuleInit();

            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TRUST_PROXY=true'));
        });

        it('should not warn when the restriction is enabled and TRUST_PROXY is a trusted proxy list', () => {
            buildService({ TRUST_PROXY: 'loopback,172.18.0.0/16' }).onModuleInit();

            expect(warnSpy).not.toHaveBeenCalled();
        });
    });
});
