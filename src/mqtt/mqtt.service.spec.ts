import { Test, TestingModule } from '@nestjs/testing';
import { MqttService } from './mqtt.service';
import { MQTT_CLIENT_PROVIDER_NAME, DEVICE_PAIR_REPLY_TOPIC_NAME, CONTROLS_UPDATE_TOPIC_NAME } from './mqtt.constants';
import { PairAcceptDto } from './dto';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';

describe('MqttService', () => {
    let service: MqttService;
    let mockClient: { emit: jest.Mock };

    const mockDevice: Partial<Device> = {
        externalId: 'device-uuid-123',
        name: 'Test Device',
        type: DeviceType.LED,
        brand: DeviceBrand.ESP32,
        room: Room.LivingRoom,
        ip: '192.168.1.100',
        controls: { on: false, brightness: 100 },
        updateInterval: 5000,
    };

    beforeEach(async () => {
        mockClient = { emit: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MqttService,
                {
                    provide: MQTT_CLIENT_PROVIDER_NAME,
                    useValue: mockClient,
                },
            ],
        }).compile();

        service = module.get<MqttService>(MqttService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('pairDevice', () => {
        it('should emit pair accept message with device details', () => {
            service.pairDevice(mockDevice as Device);

            expect(mockClient.emit).toHaveBeenCalledWith(
                DEVICE_PAIR_REPLY_TOPIC_NAME,
                expect.objectContaining({
                    accepted: true,
                    deviceId: 'device-uuid-123',
                    controls: { on: false, brightness: 100 },
                    updateInterval: 5000,
                }),
            );
        });
    });

    describe('rejectDevice', () => {
        it('should emit rejection message with reason', () => {
            service.rejectDevice('Invalid device configuration');

            expect(mockClient.emit).toHaveBeenCalledWith(
                DEVICE_PAIR_REPLY_TOPIC_NAME,
                expect.objectContaining({
                    accepted: false,
                    message: expect.stringContaining('Invalid device configuration'),
                }),
            );
        });
    });

    describe('updateDeviceControls', () => {
        it('should emit controls update to device-specific topic', async () => {
            const controls = { on: true, brightness: 50 };

            await service.updateDeviceControls('device-uuid-123', controls);

            expect(mockClient.emit).toHaveBeenCalledWith(CONTROLS_UPDATE_TOPIC_NAME.replace('+', 'device-uuid-123'), controls);
        });
    });
});

describe('PairAcceptDto', () => {
    describe('accept', () => {
        it('should create accept response with device details', () => {
            const result = PairAcceptDto.accept('device-id', { on: true }, 3000);

            expect(result).toEqual({
                accepted: true,
                deviceId: 'device-id',
                controls: { on: true },
                updateInterval: 3000,
            });
        });
    });

    describe('reject', () => {
        it('should create rejection response with error message', () => {
            const result = PairAcceptDto.reject('Error message');

            expect(result).toEqual({
                accepted: false,
                message: 'Error message',
            });
        });
    });
});
