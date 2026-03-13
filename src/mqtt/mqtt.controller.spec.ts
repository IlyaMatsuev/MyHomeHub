import { Test, TestingModule } from '@nestjs/testing';
import { MqttContext } from '@nestjs/microservices';
import { MqttController } from './mqtt.controller';
import { MqttService } from './mqtt.service';
import { DevicesService } from 'devices/devices.service';
import { PairRequestDto } from './dto';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { UpdateDeviceDto } from 'devices/dto';

describe('MqttController', () => {
    let controller: MqttController;
    let mockMqttService: {
        pairDevice: jest.Mock;
        rejectDevice: jest.Mock;
    };
    let mockDevicesService: {
        getDeviceByIp: jest.Mock;
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
    };

    beforeEach(async () => {
        mockMqttService = {
            pairDevice: jest.fn(),
            rejectDevice: jest.fn(),
        };
        mockDevicesService = {
            getDeviceByIp: jest.fn(),
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
                getPacket: jest.fn().mockReturnValue({ payload: {} }),
            };
        });

        it('should create new device if not exists', async () => {
            const pairRequest = {
                deviceIp: '192.168.1.100',
                deviceName: 'New ESP32 Device',
                deviceType: DeviceType.Fans,
                deviceBrand: DeviceBrand.ESP32,
                deviceRoom: Room.LivingRoom,
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
            expect(mockMqttService.pairDevice).toHaveBeenCalledWith(mockDevice);
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
            expect(mockMqttService.pairDevice).toHaveBeenCalledWith(mockDevice);
            expect(mockDevicesService.addDevice).not.toHaveBeenCalled();
        });

        it('should reject device on error', async () => {
            const pairRequest = {
                deviceIp: '192.168.1.100',
                deviceName: 'Failing Device',
                toCreateDevice: jest.fn(),
            } as unknown as PairRequestDto;

            mockDevicesService.getDeviceByIp.mockRejectedValue(new Error('Database error'));

            await controller.onHomeDevicePairRequest(mockContext as MqttContext, pairRequest);

            expect(mockMqttService.rejectDevice).toHaveBeenCalledWith(expect.stringContaining('Database error'));
        });

        it('should ignore requests without deviceIp', async () => {
            const pairRequest = {
                deviceIp: null,
                deviceName: null,
            } as unknown as PairRequestDto;

            await controller.onHomeDevicePairRequest(mockContext as MqttContext, pairRequest);

            expect(mockDevicesService.getDeviceByIp).not.toHaveBeenCalled();
            expect(mockMqttService.pairDevice).not.toHaveBeenCalled();
        });
    });

    describe('onHomeControlsSync', () => {
        it('should update device controls', async () => {
            const mockContext = {
                getTopic: jest.fn().mockReturnValue('home/devices/device-uuid-123/controls/sync'),
            } as unknown as MqttContext;
            const controls = { on: true, brightness: 50 };

            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            await controller.onHomeControlsSync(mockContext, controls);

            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith('device-uuid-123', expect.any(UpdateDeviceDto));
        });

        it('should handle errors gracefully', async () => {
            const mockContext = {
                getTopic: jest.fn().mockReturnValue('home/devices/device-uuid-123/controls/sync'),
            } as unknown as MqttContext;
            const controls = { on: true };

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

            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            await controller.onHomeMeasurementsUpdate(mockContext, measurements);

            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith('device-uuid-123', expect.any(UpdateDeviceDto));
        });

        it('should handle errors gracefully', async () => {
            const mockContext = {
                getTopic: jest.fn().mockReturnValue('home/devices/device-uuid-123/measurements/update'),
            } as unknown as MqttContext;
            const measurements = { temperature: 25 };

            mockDevicesService.updateDevice.mockRejectedValue(new Error('Device not found'));

            await expect(controller.onHomeMeasurementsUpdate(mockContext, measurements)).resolves.not.toThrow();
        });
    });
});
