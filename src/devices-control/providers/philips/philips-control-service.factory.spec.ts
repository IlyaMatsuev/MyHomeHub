import { ConfigService } from '@nestjs/config';
import { MqttService } from 'mqtt/mqtt.service';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { PhilipsControlServiceFactory } from './philips-control-service.factory';
import { PhilipsControlService } from './philips-control.service';

describe('PhilipsControlServiceFactory', () => {
    let factory: PhilipsControlServiceFactory;
    let mockConfigService: jest.Mocked<ConfigService>;
    let mockMqttService: jest.Mocked<MqttService>;

    const mockPhilipsDevice: Partial<Device> = {
        externalId: 'device-uuid-123',
        name: 'Philips Bulb',
        type: DeviceType.LED,
        brand: DeviceBrand.Philips,
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

        factory = new PhilipsControlServiceFactory(mockConfigService, mockMqttService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('eligible', () => {
        it('should return true for Philips devices', () => {
            expect(factory.eligible(mockPhilipsDevice as Device)).toBe(true);
        });

        it('should return false for non-Philips devices', () => {
            expect(factory.eligible(mockTuyaDevice as Device)).toBe(false);
        });
    });

    describe('createService', () => {
        it('should create PhilipsControlService for Philips device', () => {
            const service = factory.createService(mockPhilipsDevice as Device);

            expect(service).toBeInstanceOf(PhilipsControlService);
        });
    });
});
