import { Test, TestingModule } from '@nestjs/testing';
import { MqttContext } from '@nestjs/microservices';
import { DevicesMqttController } from './devices-mqtt.controller';
import { DevicesMqttService } from './devices-mqtt.service';
import { MqttService } from 'mqtt/mqtt.service';
import { MqttPairRequestDto } from './dto';
import {
    ESP32_DEVICE_CONTROLS_SYNC_TOPIC,
    ESP32_DEVICE_MEASUREMENTS_UPDATE_TOPIC,
    ESP32_DEVICE_PAIR_REQUEST_TOPIC,
} from './devices.constants';

describe('DevicesMqttController', () => {
    let controller: DevicesMqttController;
    let mockMqttService: { extractTopicWildcards: jest.Mock };
    let mockDeviceMqttService: {
        handleEsp32DevicePairRequest: jest.Mock;
        handleEsp32DeviceControlsSync: jest.Mock;
        handleEsp32DeviceMeasurementsUpdate: jest.Mock;
    };

    const makeContext = (topic: string): MqttContext =>
        ({
            getTopic: jest.fn().mockReturnValue(topic),
            getPacket: jest.fn().mockReturnValue({ payload: {} }),
        }) as unknown as MqttContext;

    beforeEach(async () => {
        mockMqttService = { extractTopicWildcards: jest.fn() };
        mockDeviceMqttService = {
            handleEsp32DevicePairRequest: jest.fn().mockResolvedValue(undefined),
            handleEsp32DeviceControlsSync: jest.fn().mockResolvedValue(undefined),
            handleEsp32DeviceMeasurementsUpdate: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DevicesMqttController],
            providers: [
                { provide: MqttService, useValue: mockMqttService },
                { provide: DevicesMqttService, useValue: mockDeviceMqttService },
            ],
        }).compile();

        controller = module.get<DevicesMqttController>(DevicesMqttController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('onEsp32DevicePairRequest', () => {
        it('should forward the pair request as a PairRequestDto instance', async () => {
            const pairRequest = {
                deviceIp: '192.168.1.100',
                deviceName: 'ESP32 Device',
            } as MqttPairRequestDto;

            await controller.onEsp32DevicePairRequest(makeContext(ESP32_DEVICE_PAIR_REQUEST_TOPIC), pairRequest);

            expect(mockDeviceMqttService.handleEsp32DevicePairRequest).toHaveBeenCalledWith(expect.any(MqttPairRequestDto));
            const forwarded = mockDeviceMqttService.handleEsp32DevicePairRequest.mock.calls[0][0];
            expect(forwarded).toMatchObject({ deviceIp: '192.168.1.100', deviceName: 'ESP32 Device' });
        });
    });

    describe('onEsp32DeviceControlsSync', () => {
        it('should extract the device id and delegate the controls sync', async () => {
            mockMqttService.extractTopicWildcards.mockReturnValue(['device-uuid-123']);
            const controls = { on: true, brightness: 50 };

            await controller.onEsp32DeviceControlsSync(makeContext('home/devices/device-uuid-123/controls/sync'), controls);

            expect(mockMqttService.extractTopicWildcards).toHaveBeenCalledWith(
                ESP32_DEVICE_CONTROLS_SYNC_TOPIC,
                'home/devices/device-uuid-123/controls/sync',
            );
            expect(mockDeviceMqttService.handleEsp32DeviceControlsSync).toHaveBeenCalledWith('device-uuid-123', controls);
        });

        it('should skip the delegation when no device id can be extracted', async () => {
            mockMqttService.extractTopicWildcards.mockReturnValue([undefined]);

            await controller.onEsp32DeviceControlsSync(makeContext('home/devices//controls/sync'), { on: true });

            expect(mockDeviceMqttService.handleEsp32DeviceControlsSync).not.toHaveBeenCalled();
        });
    });

    describe('onEsp32DeviceMeasurementsUpdate', () => {
        it('should extract the device id and delegate the measurements update', async () => {
            mockMqttService.extractTopicWildcards.mockReturnValue(['device-uuid-123']);
            const measurements = { temperature: 25, humidity: 60 };

            await controller.onEsp32DeviceMeasurementsUpdate(makeContext('home/devices/device-uuid-123/measurements/update'), measurements);

            expect(mockMqttService.extractTopicWildcards).toHaveBeenCalledWith(
                ESP32_DEVICE_MEASUREMENTS_UPDATE_TOPIC,
                'home/devices/device-uuid-123/measurements/update',
            );
            expect(mockDeviceMqttService.handleEsp32DeviceMeasurementsUpdate).toHaveBeenCalledWith('device-uuid-123', measurements);
        });

        it('should skip the delegation when no device id can be extracted', async () => {
            mockMqttService.extractTopicWildcards.mockReturnValue([undefined]);

            await controller.onEsp32DeviceMeasurementsUpdate(makeContext('home/devices//measurements/update'), { temperature: 25 });

            expect(mockDeviceMqttService.handleEsp32DeviceMeasurementsUpdate).not.toHaveBeenCalled();
        });
    });
});
