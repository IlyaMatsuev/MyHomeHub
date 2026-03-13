import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { DevicesGateway } from './devices.gateway';
import { DevicesService } from './devices.service';
import { Device, DeviceBrand, DeviceType, DeviceGatewayEvent, Room } from './interfaces';

describe('DevicesGateway', () => {
    let gateway: DevicesGateway;
    let mockDevicesService: {
        getDeviceByExternalId: jest.Mock;
        updateDevice: jest.Mock;
    };
    let mockConfigService: {
        get: jest.Mock;
    };

    const mockDevice: Partial<Device> = {
        _id: 'mongo-id-123',
        externalId: 'device-uuid-123',
        name: 'Test Device',
        type: DeviceType.LED,
        brand: DeviceBrand.Tuya,
        room: Room.LivingRoom,
        updateInterval: 5000,
        controls: { on: false },
        measurements: {},
    };

    const createMockClient = (id?: string) => ({
        id: id || '',
        send: jest.fn(),
    });

    beforeEach(async () => {
        mockDevicesService = {
            getDeviceByExternalId: jest.fn(),
            updateDevice: jest.fn(),
        };
        mockConfigService = {
            get: jest.fn().mockReturnValue('valid-access-key'),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DevicesGateway,
                {
                    provide: DevicesService,
                    useValue: mockDevicesService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        gateway = module.get<DevicesGateway>(DevicesGateway);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('handleConnection', () => {
        it('should add client to clients map with generated UUID', () => {
            const client = createMockClient();

            gateway.handleConnection(client as never);

            expect(client.id).toBeDefined();
            expect(client.id.length).toBeGreaterThan(0);
            expect(gateway.clients.has(client.id)).toBe(true);
        });
    });

    describe('handleDisconnect', () => {
        it('should remove client from clients map', () => {
            const client = createMockClient('client-id-123');
            gateway.clients.set('client-id-123', client as never);

            gateway.handleDisconnect(client as never);

            expect(gateway.clients.has('client-id-123')).toBe(false);
        });
    });

    describe('onDevicePairing', () => {
        it('should successfully pair device', async () => {
            const client = createMockClient('client-id-123');
            gateway.clients.set('client-id-123', client as never);
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);

            const result = await gateway.onDevicePairing(client as never, 'device-uuid-123', 'valid-access-key');

            expect(result).toEqual({
                event: DeviceGatewayEvent.Pair,
                data: {
                    success: true,
                    updateInterval: mockDevice.updateInterval,
                },
            });
            expect(gateway.pairedDevices.has('client-id-123')).toBe(true);
        });

        it('should throw WsException if client is not recognized', async () => {
            const client = createMockClient('unknown-client');

            await expect(gateway.onDevicePairing(client as never, 'device-uuid-123', 'valid-access-key')).rejects.toThrow(WsException);
        });

        it('should throw WsException if device is already paired', async () => {
            const client = createMockClient('client-id-123');
            gateway.clients.set('client-id-123', client as never);
            gateway.pairedDevices.set('client-id-123', mockDevice as Device);

            await expect(gateway.onDevicePairing(client as never, 'device-uuid-123', 'valid-access-key')).rejects.toThrow(
                new WsException('The device has already been paired'),
            );
        });

        it('should throw WsException if access key is invalid', async () => {
            const client = createMockClient('client-id-123');
            gateway.clients.set('client-id-123', client as never);

            await expect(gateway.onDevicePairing(client as never, 'device-uuid-123', 'invalid-key')).rejects.toThrow(
                new WsException('Device access key is not valid'),
            );
        });

        it('should throw WsException if device not found', async () => {
            const client = createMockClient('client-id-123');
            gateway.clients.set('client-id-123', client as never);
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(null);

            await expect(gateway.onDevicePairing(client as never, 'device-uuid-123', 'valid-access-key')).rejects.toThrow(WsException);
        });
    });

    describe('onDeviceStateUpdate', () => {
        it('should update device state successfully', async () => {
            const client = createMockClient('client-id-123');
            gateway.clients.set('client-id-123', client as never);
            gateway.pairedDevices.set('client-id-123', mockDevice as Device);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            const stateDto = { controls: { on: true }, measurements: { power: 100 } };
            const result = await gateway.onDeviceStateUpdate(client as never, stateDto as never);

            expect(result).toEqual({
                event: DeviceGatewayEvent.State,
                data: {
                    success: true,
                    updateInterval: mockDevice.updateInterval,
                },
            });
            expect(mockDevicesService.updateDevice).toHaveBeenCalled();
        });

        it('should throw WsException if client is not recognized', async () => {
            const client = createMockClient('unknown-client');
            const stateDto = { controls: { on: true } };

            await expect(gateway.onDeviceStateUpdate(client as never, stateDto as never)).rejects.toThrow(WsException);
        });

        it('should throw WsException if client is not paired', async () => {
            const client = createMockClient('client-id-123');
            gateway.clients.set('client-id-123', client as never);
            const stateDto = { controls: { on: true } };

            await expect(gateway.onDeviceStateUpdate(client as never, stateDto as never)).rejects.toThrow(WsException);
        });
    });
});
