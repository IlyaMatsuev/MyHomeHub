import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService } from './discovery.service';
import * as dgram from 'node:dgram';
import * as os from 'node:os';

jest.mock('node:dgram');
jest.mock('node:os');

describe('DiscoveryService', () => {
    let service: DiscoveryService;
    let mockConfigService: {
        get: jest.Mock;
    };
    let mockSocket: {
        on: jest.Mock;
        bind: jest.Mock;
        close: jest.Mock;
        send: jest.Mock;
        setBroadcast: jest.Mock;
        address: jest.Mock;
    };

    beforeEach(async () => {
        mockConfigService = {
            get: jest.fn(),
        };

        mockSocket = {
            on: jest.fn(),
            bind: jest.fn(),
            close: jest.fn(),
            send: jest.fn(),
            setBroadcast: jest.fn(),
            address: jest.fn().mockReturnValue({ port: 5353 }),
        };

        (dgram.createSocket as jest.Mock).mockReturnValue(mockSocket);
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
            mockConfigService.get.mockImplementation((key: string) => {
                const config: Record<string, string> = {
                    SERVER_LABEL: 'My Smart Home',
                    PORT: '3000',
                };
                return config[key];
            });

            const result = service.getServerInfo();

            expect(result).toEqual({
                label: 'My Smart Home',
                address: '192.168.1.100',
                port: 3000,
            });
        });

        it('should return default label when SERVER_LABEL not configured', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                const config: Record<string, string> = {
                    PORT: '3000',
                };
                return config[key];
            });

            const result = service.getServerInfo();

            expect(result.label).toBe('SmartHome Hub');
        });

        it('should return default port when PORT not configured', () => {
            mockConfigService.get.mockReturnValue(undefined);

            const result = service.getServerInfo();

            expect(result.port).toBe(3000);
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
        it('should create and bind UDP socket on init', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                const config: Record<string, string> = {
                    UDP_PORT: '5353',
                    DISCOVERY_MESSAGE: 'SMARTHOME_HUB_DISCOVER',
                };
                return config[key];
            });

            mockSocket.bind.mockImplementation((port, callback) => {
                callback?.();
            });

            service.onModuleInit();

            expect(dgram.createSocket).toHaveBeenCalledWith({ type: 'udp4', reuseAddr: true });
            expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('listening', expect.any(Function));
            expect(mockSocket.bind).toHaveBeenCalledWith(5353, expect.any(Function));
            expect(mockSocket.setBroadcast).toHaveBeenCalledWith(true);
        });

        it('should use default UDP port when not configured', () => {
            mockConfigService.get.mockReturnValue(undefined);

            mockSocket.bind.mockImplementation((port, callback) => {
                callback?.();
            });

            service.onModuleInit();

            expect(mockSocket.bind).toHaveBeenCalledWith(5353, expect.any(Function));
        });
    });

    describe('onModuleDestroy', () => {
        it('should close socket on destroy', () => {
            mockConfigService.get.mockReturnValue(undefined);
            mockSocket.bind.mockImplementation((port, callback) => {
                callback?.();
            });

            service.onModuleInit();
            service.onModuleDestroy();

            expect(mockSocket.close).toHaveBeenCalled();
        });
    });

    describe('UDP message handling', () => {
        it('should respond to valid discovery message', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                const config: Record<string, string> = {
                    DISCOVERY_MESSAGE: 'SMARTHOME_HUB_DISCOVER',
                    SERVER_LABEL: 'Test Hub',
                    PORT: '3000',
                };
                return config[key];
            });

            let messageHandler: (msg: Buffer, rinfo: dgram.RemoteInfo) => void;
            mockSocket.on.mockImplementation((event, handler) => {
                if (event === 'message') {
                    messageHandler = handler;
                }
            });
            mockSocket.bind.mockImplementation((port, callback) => {
                callback?.();
            });
            mockSocket.send.mockImplementation((...args: Array<unknown>) => {
                const callback = args[5] as () => void;
                callback?.();
            });

            service.onModuleInit();

            const rinfo: dgram.RemoteInfo = {
                address: '192.168.1.50',
                port: 12345,
                family: 'IPv4',
                size: 18,
            };
            messageHandler(Buffer.from('SMARTHOME_HUB_DISCOVER'), rinfo);

            expect(mockSocket.send).toHaveBeenCalled();
            const sendCall = mockSocket.send.mock.calls[0];
            const responseBuffer = sendCall[0] as Buffer;
            const response = JSON.parse(responseBuffer.toString());
            expect(response).toEqual({
                label: 'Test Hub',
                address: '192.168.1.100',
                port: 3000,
            });
            expect(sendCall[3]).toBe(12345);
            expect(sendCall[4]).toBe('192.168.1.50');
        });

        it('should ignore invalid discovery message', () => {
            mockConfigService.get.mockImplementation((key: string) => {
                const config: Record<string, string> = {
                    DISCOVERY_MESSAGE: 'SMARTHOME_HUB_DISCOVER',
                };
                return config[key];
            });

            let messageHandler: (msg: Buffer, rinfo: dgram.RemoteInfo) => void;
            mockSocket.on.mockImplementation((event, handler) => {
                if (event === 'message') {
                    messageHandler = handler;
                }
            });
            mockSocket.bind.mockImplementation((port, callback) => {
                callback?.();
            });

            service.onModuleInit();

            const rinfo: dgram.RemoteInfo = {
                address: '192.168.1.50',
                port: 12345,
                family: 'IPv4',
                size: 10,
            };
            messageHandler(Buffer.from('WRONG_MESSAGE'), rinfo);

            expect(mockSocket.send).not.toHaveBeenCalled();
        });

        it('should use default discovery message when not configured', () => {
            mockConfigService.get.mockReturnValue(undefined);

            let messageHandler: (msg: Buffer, rinfo: dgram.RemoteInfo) => void;
            mockSocket.on.mockImplementation((event, handler) => {
                if (event === 'message') {
                    messageHandler = handler;
                }
            });
            mockSocket.bind.mockImplementation((port, callback) => {
                callback?.();
            });
            mockSocket.send.mockImplementation((...args: Array<unknown>) => {
                const callback = args[5] as () => void;
                callback?.();
            });

            service.onModuleInit();

            const rinfo: dgram.RemoteInfo = {
                address: '192.168.1.50',
                port: 12345,
                family: 'IPv4',
                size: 18,
            };
            messageHandler(Buffer.from('SMARTHOME_HUB_DISCOVER'), rinfo);

            expect(mockSocket.send).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should close socket on error', () => {
            mockConfigService.get.mockReturnValue(undefined);

            let errorHandler: (err: Error) => void;
            mockSocket.on.mockImplementation((event, handler) => {
                if (event === 'error') {
                    errorHandler = handler;
                }
            });
            mockSocket.bind.mockImplementation((port, callback) => {
                callback?.();
            });

            service.onModuleInit();

            errorHandler(new Error('Socket error'));

            expect(mockSocket.close).toHaveBeenCalled();
        });
    });
});
