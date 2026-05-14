import { ConfigService } from '@nestjs/config';
import { MqttService } from 'mqtt/mqtt.service';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { ZigbeeControlServiceFactory } from './zigbee-control-service.factory';
import { ZigbeeControlService } from './zigbee-control.service';

describe('ZigbeeControlServiceFactory', () => {
    let factory: ZigbeeControlServiceFactory;
    let mockConfigService: jest.Mocked<ConfigService>;
    let mockMqttService: jest.Mocked<MqttService>;

    const mockZigbeeDevice: Partial<Device> = {
        externalId: 'device-uuid-123',
        name: 'Zigbee Bulb',
        type: DeviceType.LED,
        brand: DeviceBrand.Zigbee,
        zigbeeFriendlyName: 'living_room_bulb',
        zigbeeIeeeAddress: '0x00158d0001234567',
        room: Room.LivingRoom,
    };

    const mockTuyaDevice: Partial<Device> = {
        externalId: 'device-uuid-456',
        name: 'Tuya Plug',
        type: DeviceType.Plug,
        brand: DeviceBrand.Tuya,
        room: Room.LivingRoom,
    };

    beforeEach(() => {
        mockConfigService = {} as jest.Mocked<ConfigService>;
        mockMqttService = {
            publishZigbeeCommand: jest.fn(),
        } as unknown as jest.Mocked<MqttService>;

        factory = new ZigbeeControlServiceFactory(mockConfigService, mockMqttService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('eligible', () => {
        it('should return true for Zigbee devices', () => {
            expect(factory.eligible(mockZigbeeDevice as Device)).toBe(true);
        });

        it('should return false for non-Zigbee devices', () => {
            expect(factory.eligible(mockTuyaDevice as Device)).toBe(false);
        });
    });

    describe('createService', () => {
        it('should create ZigbeeControlService for Zigbee device', () => {
            const service = factory.createService(mockZigbeeDevice as Device);

            expect(service).toBeInstanceOf(ZigbeeControlService);
        });
    });
});
