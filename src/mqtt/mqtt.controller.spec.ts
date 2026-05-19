import { Test, TestingModule } from '@nestjs/testing';
import { MqttContext } from '@nestjs/microservices';
import { MqttController } from './mqtt.controller';
import { MqttService } from './mqtt.service';
import { CONTROLS_SYNC_TOPIC_NAME, DEVICE_PAIR_REPLY_TOPIC_NAME, MEASUREMENTS_UPDATE_TOPIC_NAME } from './mqtt.constants';
import { DevicesService } from 'devices/devices.service';
import { PairRequestDto } from './dto';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { UpdateDeviceDto } from 'devices/dto';

describe('MqttController', () => {
    let controller: MqttController;
    let mockMqttService: {
        publish: jest.Mock;
        extractTopicWildcards: jest.Mock;
    };
    let mockDevicesService: {
        getDeviceByIp: jest.Mock;
        getDevice: jest.Mock;
        addDevice: jest.Mock;
        updateDevice: jest.Mock;
    };

    const mockDevice: Partial<Device> = {
        _id: 'mongo-id-123',
        externalId: 'device-uuid-123',
        name: 'Test Device',
        type: DeviceType.Fans,
        brand: DeviceBrand.ESP32,
        room: Room.LivingRoom,
        ip: '192.168.1.100',
        controls: { on: false },
        measurements: {},
        updateInterval: 5000,
    };

    beforeEach(async () => {
        mockMqttService = {
            publish: jest.fn(),
            extractTopicWildcards: jest.fn(),
        };
        mockDevicesService = {
            getDeviceByIp: jest.fn(),
            getDevice: jest.fn(),
            addDevice: jest.fn(),
            updateDevice: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [MqttController],
            providers: [
                {
                    provide: MqttService,
                    useValue: mockMqttService,
                },
                {
                    provide: DevicesService,
                    useValue: mockDevicesService,
                },
            ],
        }).compile();

        controller = module.get<MqttController>(MqttController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('onHomeDevicePairRequest', () => {
        let mockContext: Partial<MqttContext>;

        beforeEach(() => {
            mockContext = {
                getTopic: jest.fn().mockReturnValue('home/devices/pair'),
                getPacket: jest.fn().mockReturnValue({ payload: {} }),
            };
        });

        it('should create new device if not exists and publish a pair accept', async () => {
            const pairRequest = {
                deviceIp: '192.168.1.100',
                deviceName: 'New ESP32 Device',
                controls: { on: false },
                measurements: {},
                toCreateDevice: jest.fn().mockReturnValue({
                    name: 'New ESP32 Device',
                    type: DeviceType.Fans,
                    brand: DeviceBrand.ESP32,
                    room: Room.LivingRoom,
                    ip: '192.168.1.100',
                }),
            } as unknown as PairRequestDto;

            mockDevicesService.getDeviceByIp.mockResolvedValue(null);
            mockDevicesService.addDevice.mockResolvedValue(mockDevice);

            await controller.onHomeDevicePairRequest(mockContext as MqttContext, pairRequest);

            expect(mockDevicesService.getDeviceByIp).toHaveBeenCalledWith('192.168.1.100', { strict: false });
            expect(mockDevicesService.addDevice).toHaveBeenCalled();
            expect(mockMqttService.publish).toHaveBeenCalledWith(
                DEVICE_PAIR_REPLY_TOPIC_NAME,
                expect.objectContaining({
                    accepted: true,
                    deviceId: 'device-uuid-123',
                    controls: mockDevice.controls,
                    updateInterval: 5000,
                }),
            );
        });

        it('should update existing device if already exists', async () => {
            const pairRequest = {
                deviceIp: '192.168.1.100',
                deviceName: 'Existing Device',
                controls: { on: true },
                measurements: { temperature: 25 },
                toCreateDevice: jest.fn(),
            } as unknown as PairRequestDto;

            mockDevicesService.getDeviceByIp.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            await controller.onHomeDevicePairRequest(mockContext as MqttContext, pairRequest);

            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith('device-uuid-123', expect.any(UpdateDeviceDto));
            expect(mockMqttService.publish).toHaveBeenCalledWith(
                DEVICE_PAIR_REPLY_TOPIC_NAME,
                expect.objectContaining({ accepted: true, deviceId: 'device-uuid-123' }),
            );
            expect(mockDevicesService.addDevice).not.toHaveBeenCalled();
        });

        it('should publish a rejection message on error', async () => {
            const pairRequest = {
                deviceIp: '192.168.1.100',
                deviceName: 'Failing Device',
                toCreateDevice: jest.fn(),
            } as unknown as PairRequestDto;

            mockDevicesService.getDeviceByIp.mockRejectedValue(new Error('Database error'));

            await controller.onHomeDevicePairRequest(mockContext as MqttContext, pairRequest);

            expect(mockMqttService.publish).toHaveBeenCalledWith(
                DEVICE_PAIR_REPLY_TOPIC_NAME,
                expect.objectContaining({
                    accepted: false,
                    message: expect.stringContaining('Database error'),
                }),
            );
        });

        it('should ignore requests without deviceIp', async () => {
            const pairRequest = {
                deviceIp: null,
                deviceName: null,
            } as unknown as PairRequestDto;

            await controller.onHomeDevicePairRequest(mockContext as MqttContext, pairRequest);

            expect(mockDevicesService.getDeviceByIp).not.toHaveBeenCalled();
            expect(mockMqttService.publish).not.toHaveBeenCalled();
        });
    });

    describe('onHomeControlsSync', () => {
        it('should update device controls', async () => {
            const mockContext = {
                getTopic: jest.fn().mockReturnValue('home/devices/device-uuid-123/controls/sync'),
            } as unknown as MqttContext;
            const controls = { on: true, brightness: 50 };
            mockMqttService.extractTopicWildcards.mockReturnValue(['device-uuid-123']);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            await controller.onHomeControlsSync(mockContext, controls);

            expect(mockMqttService.extractTopicWildcards).toHaveBeenCalledWith(
                CONTROLS_SYNC_TOPIC_NAME,
                'home/devices/device-uuid-123/controls/sync',
            );
            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith('device-uuid-123', expect.any(UpdateDeviceDto));
        });

        it('should handle errors gracefully', async () => {
            const mockContext = {
                getTopic: jest.fn().mockReturnValue('home/devices/device-uuid-123/controls/sync'),
            } as unknown as MqttContext;
            const controls = { on: true };
            mockMqttService.extractTopicWildcards.mockReturnValue(['device-uuid-123']);
            mockDevicesService.updateDevice.mockRejectedValue(new Error('Device not found'));

            await expect(controller.onHomeControlsSync(mockContext, controls)).resolves.not.toThrow();
        });
    });

    describe('onHomeMeasurementsUpdate', () => {
        it('should update device measurements', async () => {
            const mockContext = {
                getTopic: jest.fn().mockReturnValue('home/devices/device-uuid-123/measurements/update'),
            } as unknown as MqttContext;
            const measurements = { temperature: 25, humidity: 60 };
            mockMqttService.extractTopicWildcards.mockReturnValue(['device-uuid-123']);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            await controller.onHomeMeasurementsUpdate(mockContext, measurements);

            expect(mockMqttService.extractTopicWildcards).toHaveBeenCalledWith(
                MEASUREMENTS_UPDATE_TOPIC_NAME,
                'home/devices/device-uuid-123/measurements/update',
            );
            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith('device-uuid-123', expect.any(UpdateDeviceDto));
        });

        it('should handle errors gracefully', async () => {
            const mockContext = {
                getTopic: jest.fn().mockReturnValue('home/devices/device-uuid-123/measurements/update'),
            } as unknown as MqttContext;
            const measurements = { temperature: 25 };
            mockMqttService.extractTopicWildcards.mockReturnValue(['device-uuid-123']);
            mockDevicesService.updateDevice.mockRejectedValue(new Error('Device not found'));

            await expect(controller.onHomeMeasurementsUpdate(mockContext, measurements)).resolves.not.toThrow();
        });
    });
});
