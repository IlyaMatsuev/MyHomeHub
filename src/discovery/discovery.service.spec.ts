import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Bonjour } from 'bonjour-service';
import { DiscoveryService } from 'discovery/discovery.service';
import * as os from 'node:os';

jest.mock('node:os');
jest.mock('bonjour-service', () => ({
    Bonjour: jest.fn(),
}));

describe('DiscoveryService', () => {
    let service: DiscoveryService;
    let mockConfigService: {
        get: jest.Mock;
    };
    let mockPublishedService: {
        on: jest.Mock;
        fqdn: string;
    };
    let mockBonjour: {
        publish: jest.Mock;
        unpublishAll: jest.Mock;
        destroy: jest.Mock;
    };

    const withConfig = (config: Record<string, string>): void => {
        mockConfigService.get.mockImplementation((key: string) => config[key]);
    };

    const withDiscoveryEnabled = (config: Record<string, string> = {}): void => {
        withConfig({ SERVER_DISCOVERY_ENABLED: 'true', ...config });
    };

    const getServiceHandler = (event: string): ((arg?: Error) => void) => {
        return mockPublishedService.on.mock.calls.find(([name]) => name === event)?.[1];
    };

    const getResponderErrorCallback = (): ((err: Error) => void) => {
        return (Bonjour as unknown as jest.Mock).mock.calls[0]?.[1];
    };

    beforeEach(async () => {
        mockConfigService = {
            get: jest.fn(),
        };

        mockPublishedService = {
            on: jest.fn(),
            fqdn: 'Test Hub._myhomehub._tcp.local',
        };

        mockBonjour = {
            publish: jest.fn().mockReturnValue(mockPublishedService),
            unpublishAll: jest.fn((callback?: () => void) => callback?.()),
            destroy: jest.fn((callback?: () => void) => callback?.()),
        };

        (Bonjour as unknown as jest.Mock).mockImplementation(() => mockBonjour);
        (os.networkInterfaces as jest.Mock).mockReturnValue({
            eth0: [
                { family: 'IPv4', address: '192.168.1.100', internal: false },
                { family: 'IPv6', address: 'fe80::1', internal: false },
            ],
            lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DiscoveryService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<DiscoveryService>(DiscoveryService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getServerInfo', () => {
        it('should return server info with configured values', () => {
            withConfig({ SERVER_LABEL: 'My Smart Home', PORT: '3000' });

            const result = service.getServerInfo();

            expect(result).toEqual({
                label: 'My Smart Home',
                address: '192.168.1.100',
                port: 3000,
            });
        });

        it('should return default label when SERVER_LABEL not configured', () => {
            withConfig({ PORT: '3000' });

            const result = service.getServerInfo();

            expect(result.label).toBe('My Home Hub');
        });

        it('should return default port when PORT not configured', () => {
            mockConfigService.get.mockReturnValue(undefined);

            const result = service.getServerInfo();

            expect(result.port).toBe(3000);
        });

        it('should use SERVER_EXTERNAL_ADDRESS when configured', () => {
            withConfig({ SERVER_EXTERNAL_ADDRESS: 'hub.local', PORT: '3000' });

            const result = service.getServerInfo();

            expect(result.address).toBe('hub.local');
        });

        it('should use SERVER_EXTERNAL_PORT when configured', () => {
            withConfig({ SERVER_EXTERNAL_PORT: '443', PORT: '3000' });

            const result = service.getServerInfo();

            expect(result.port).toBe(443);
        });

        it('should prefer SERVER_EXTERNAL_PORT over PORT', () => {
            withConfig({ SERVER_EXTERNAL_PORT: '8080', PORT: '3000' });

            const result = service.getServerInfo();

            expect(result.port).toBe(8080);
        });

        it('should fall back to auto-detected IP when SERVER_EXTERNAL_ADDRESS not configured', () => {
            withConfig({ PORT: '3000' });

            const result = service.getServerInfo();

            expect(result.address).toBe('192.168.1.100');
        });

        it('should return 127.0.0.1 when no external network interface found', () => {
            (os.networkInterfaces as jest.Mock).mockReturnValue({
                lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
            });
            mockConfigService.get.mockReturnValue(undefined);

            const result = service.getServerInfo();

            expect(result.address).toBe('127.0.0.1');
        });
    });

    describe('onModuleInit', () => {
        it('should publish the mDNS service with the server info on init', () => {
            withDiscoveryEnabled({ SERVER_LABEL: 'Test Hub', PORT: '3000' });

            service.onModuleInit();

            expect(mockBonjour.publish).toHaveBeenCalledWith({
                name: 'Test Hub',
                type: 'myhomehub',
                protocol: 'tcp',
                port: 3000,
                txt: {
                    label: 'Test Hub',
                    address: '192.168.1.100',
                    port: '3000',
                },
            });
        });

        it('should publish under the configured service type', () => {
            withDiscoveryEnabled({ SERVER_LABEL: 'Test Hub', PORT: '3000', SERVER_MDNS_SERVICE_TYPE: 'customhub' });

            service.onModuleInit();

            expect(mockBonjour.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'customhub' }));
        });

        it('should advertise the external port and address when configured', () => {
            withDiscoveryEnabled({ PORT: '3000', SERVER_EXTERNAL_PORT: '443', SERVER_EXTERNAL_ADDRESS: 'hub.example.com' });

            service.onModuleInit();

            expect(mockBonjour.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    port: 443,
                    txt: expect.objectContaining({ address: 'hub.example.com', port: '443' }),
                }),
            );
        });

        it('should not advertise anything when SERVER_DISCOVERY_ENABLED is "false"', () => {
            withConfig({ SERVER_DISCOVERY_ENABLED: 'false', PORT: '3000' });

            service.onModuleInit();

            expect(Bonjour).not.toHaveBeenCalled();
            expect(mockBonjour.publish).not.toHaveBeenCalled();
        });

        it('should use the server label as the mDNS instance name', () => {
            withDiscoveryEnabled({ PORT: '3000' });

            service.onModuleInit();

            expect(mockBonjour.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Home Hub' }));
        });

        it('should not advertise anything when SERVER_DISCOVERY_ENABLED is not configured', () => {
            withConfig({ PORT: '3000' });

            service.onModuleInit();

            expect(Bonjour).not.toHaveBeenCalled();
            expect(mockBonjour.publish).not.toHaveBeenCalled();
        });

        it('should not advertise anything when SERVER_DISCOVERY_ENABLED is not exactly "true"', () => {
            withConfig({ SERVER_DISCOVERY_ENABLED: 'TRUE', PORT: '3000' });

            service.onModuleInit();

            expect(Bonjour).not.toHaveBeenCalled();
            expect(mockBonjour.publish).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should log responder errors instead of rethrowing them', () => {
            withDiscoveryEnabled({ PORT: '3000' });

            service.onModuleInit();
            const errorCallback = getResponderErrorCallback();

            expect(errorCallback).toBeDefined();
            expect(() => errorCallback(new Error('Port 5353 is already in use'))).not.toThrow();
        });

        it('should handle the service error event without rethrowing', () => {
            withDiscoveryEnabled({ PORT: '3000' });

            service.onModuleInit();
            const errorHandler = getServiceHandler('error');

            expect(errorHandler).toBeDefined();
            expect(() => errorHandler(new Error('Advertisement failed'))).not.toThrow();
        });

        it('should log the advertisement once the service is up', () => {
            withDiscoveryEnabled({ PORT: '3000' });

            service.onModuleInit();
            const upHandler = getServiceHandler('up');

            expect(upHandler).toBeDefined();
            expect(() => upHandler()).not.toThrow();
        });
    });

    describe('onModuleDestroy', () => {
        it('should unpublish the service and destroy the responder', async () => {
            withDiscoveryEnabled({ PORT: '3000' });

            service.onModuleInit();
            await service.onModuleDestroy();

            expect(mockBonjour.unpublishAll).toHaveBeenCalled();
            expect(mockBonjour.destroy).toHaveBeenCalled();
        });

        it('should do nothing when the advertisement was never started', async () => {
            withConfig({ SERVER_DISCOVERY_ENABLED: 'false', PORT: '3000' });

            service.onModuleInit();
            await service.onModuleDestroy();

            expect(mockBonjour.unpublishAll).not.toHaveBeenCalled();
            expect(mockBonjour.destroy).not.toHaveBeenCalled();
        });

        it('should be safe to call twice', async () => {
            withDiscoveryEnabled({ PORT: '3000' });

            service.onModuleInit();
            await service.onModuleDestroy();
            await service.onModuleDestroy();

            expect(mockBonjour.destroy).toHaveBeenCalledTimes(1);
        });
    });
});
