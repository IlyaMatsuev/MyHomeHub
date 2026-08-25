import { Test, TestingModule } from '@nestjs/testing';
import { DevicesMqttService } from './devices-mqtt.service';
import { DevicesService } from './devices.service';
import { MqttService } from 'mqtt/mqtt.service';
import { PairAcceptDto, PairRequestDto, UpdateDeviceDto } from './dto';
import { Device, DeviceBrand, DeviceType, DeviceUpdateOrigin, Room } from './interfaces';
import { ESP32_DEVICE_PAIR_REQUEST_REPLY_TOPIC } from './devices.constants';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';

describe('DevicesMqttService', () => {
    let service: DevicesMqttService;
    let mockMqttService: { publish: jest.Mock };
    let mockDevicesService: {
        getDeviceByIp: jest.Mock;
        getDeviceByExternalId: jest.Mock;
        addDevice: jest.Mock;
        updateDevice: jest.Mock;
    };
    let mockDeviceConfigsMapper: { mapPayloadFromDevice: jest.Mock };

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
        mockMqttService = { publish: jest.fn() };
        mockDevicesService = {
            getDeviceByIp: jest.fn(),
            getDeviceByExternalId: jest.fn(),
            addDevice: jest.fn(),
            updateDevice: jest.fn(),
        };
        mockDeviceConfigsMapper = {
            mapPayloadFromDevice: jest.fn((_device, _section, payload) => Promise.resolve(payload)),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DevicesMqttService,
                { provide: MqttService, useValue: mockMqttService },
                { provide: DevicesService, useValue: mockDevicesService },
                { provide: DeviceConfigsMapperService, useValue: mockDeviceConfigsMapper },
            ],
        }).compile();

        service = module.get<DevicesMqttService>(DevicesMqttService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('handleEsp32DevicePairRequest', () => {
        it('should create a new device when none exists and publish an accept reply', async () => {
            const pairRequest = {
                deviceIp: '192.168.1.100',
                deviceName: 'New ESP32 Device',
                controls: { on: false },
                measurements: {},
                toCreateDevice: jest.fn().mockReturnValue({
                    name: 'New ESP32 Device',
                    type: DeviceType.Fans,
                    brand: DeviceBrand.ESP32,
                    ip: '192.168.1.100',
                }),
            } as unknown as PairRequestDto;

            mockDevicesService.getDeviceByIp.mockResolvedValue(null);
            mockDevicesService.addDevice.mockResolvedValue(mockDevice);

            await service.handleEsp32DevicePairRequest(pairRequest);

            expect(mockDevicesService.getDeviceByIp).toHaveBeenCalledWith('192.168.1.100');
            expect(mockDevicesService.addDevice).toHaveBeenCalled();
            expect(mockMqttService.publish).toHaveBeenCalledWith(
                ESP32_DEVICE_PAIR_REQUEST_REPLY_TOPIC,
                expect.objectContaining({
                    accepted: true,
                    deviceId: 'device-uuid-123',
                    controls: mockDevice.controls,
                    updateInterval: 5000,
                }),
            );
        });

        it('should pass the pairing payload as device originated, so a bad field is dropped instead of rejecting the device', async () => {
            const pairRequest = {
                deviceIp: '192.168.1.100',
                deviceName: 'New ESP32 Device',
                toCreateDevice: jest.fn().mockReturnValue({ name: 'New ESP32 Device' }),
            } as unknown as PairRequestDto;

            mockDevicesService.getDeviceByIp.mockResolvedValue(null);
            mockDevicesService.addDevice.mockResolvedValue(mockDevice);

            await service.handleEsp32DevicePairRequest(pairRequest);

            expect(mockDevicesService.addDevice).toHaveBeenCalledWith(expect.anything(), { origin: DeviceUpdateOrigin.Device });
        });

        it('should not send the controls seeded with null back to the device', async () => {
            const pairRequest = {
                deviceIp: '192.168.1.100',
                deviceName: 'New ESP32 Device',
                toCreateDevice: jest.fn().mockReturnValue({ name: 'New ESP32 Device' }),
            } as unknown as PairRequestDto;

            mockDevicesService.getDeviceByIp.mockResolvedValue(null);
            mockDevicesService.addDevice.mockResolvedValue({
                ...mockDevice,
                controls: { on: false, speedLevels: null, temperature: null },
            } as Device);

            await service.handleEsp32DevicePairRequest(pairRequest);

            expect(mockMqttService.publish).toHaveBeenCalledWith(
                ESP32_DEVICE_PAIR_REQUEST_REPLY_TOPIC,
                expect.objectContaining({ controls: { on: false } }),
            );
        });

        it('should update an existing device and publish an accept reply', async () => {
            const pairRequest = {
                deviceIp: '192.168.1.100',
                deviceName: 'Existing Device',
                controls: { on: true },
                measurements: { temperature: 25 },
                toCreateDevice: jest.fn(),
            } as unknown as PairRequestDto;

            mockDevicesService.getDeviceByIp.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            await service.handleEsp32DevicePairRequest(pairRequest);

            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith('device-uuid-123', expect.any(UpdateDeviceDto), {
                propagateControls: false,
                origin: DeviceUpdateOrigin.Device,
            });
            expect(mockDevicesService.addDevice).not.toHaveBeenCalled();
            expect(mockMqttService.publish).toHaveBeenCalledWith(
                ESP32_DEVICE_PAIR_REQUEST_REPLY_TOPIC,
                expect.objectContaining({ accepted: true, deviceId: 'device-uuid-123' }),
            );
        });

        it('should publish a rejection reply when an error is thrown', async () => {
            const pairRequest = {
                deviceIp: '192.168.1.100',
                deviceName: 'Failing Device',
                toCreateDevice: jest.fn(),
            } as unknown as PairRequestDto;

            mockDevicesService.getDeviceByIp.mockRejectedValue(new Error('Database error'));

            await service.handleEsp32DevicePairRequest(pairRequest);

            expect(mockMqttService.publish).toHaveBeenCalledWith(
                ESP32_DEVICE_PAIR_REQUEST_REPLY_TOPIC,
                expect.objectContaining({
                    accepted: false,
                    message: expect.stringContaining('Database error'),
                }),
            );
        });

        it('should ignore requests missing device ip or name', async () => {
            const pairRequest = {
                deviceIp: null,
                deviceName: null,
            } as unknown as PairRequestDto;

            await service.handleEsp32DevicePairRequest(pairRequest);

            expect(mockDevicesService.getDeviceByIp).not.toHaveBeenCalled();
            expect(mockMqttService.publish).not.toHaveBeenCalled();
        });
    });

    describe('handleEsp32DeviceControlsSync', () => {
        it('should update the device controls when the device exists', async () => {
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            await service.handleEsp32DeviceControlsSync('device-uuid-123', { on: true, brightness: 50 });

            expect(mockDevicesService.getDeviceByExternalId).toHaveBeenCalledWith('device-uuid-123', { strict: false });
            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith('device-uuid-123', expect.any(UpdateDeviceDto), {
                propagateControls: false,
                origin: DeviceUpdateOrigin.Device,
            });
            const dto = mockDevicesService.updateDevice.mock.calls[0][1];
            expect(dto.controls).toEqual({ on: true, brightness: 50 });
        });

        it('should map the incoming controls using the device config', async () => {
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);
            mockDeviceConfigsMapper.mapPayloadFromDevice.mockResolvedValue({ on: true });

            await service.handleEsp32DeviceControlsSync('device-uuid-123', { state: 'ON' });

            expect(mockDeviceConfigsMapper.mapPayloadFromDevice).toHaveBeenCalledWith(mockDevice, 'controls', { state: 'ON' });
            const dto = mockDevicesService.updateDevice.mock.calls[0][1];
            expect(dto.controls).toEqual({ on: true });
        });

        it('should skip the update when no device matches the id', async () => {
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(null);

            await service.handleEsp32DeviceControlsSync('unknown', { on: true });

            expect(mockDevicesService.updateDevice).not.toHaveBeenCalled();
            expect(mockDeviceConfigsMapper.mapPayloadFromDevice).not.toHaveBeenCalled();
        });

        it('should swallow errors thrown while updating controls', async () => {
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockRejectedValue(new Error('Device not found'));

            await expect(service.handleEsp32DeviceControlsSync('device-uuid-123', { on: true })).resolves.toBeUndefined();
        });
    });

    describe('handleEsp32DeviceMeasurementsUpdate', () => {
        it('should update the device measurements when the device exists', async () => {
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);

            await service.handleEsp32DeviceMeasurementsUpdate('device-uuid-123', { temperature: 25, humidity: 60 });

            expect(mockDevicesService.getDeviceByExternalId).toHaveBeenCalledWith('device-uuid-123', { strict: false });
            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith('device-uuid-123', expect.any(UpdateDeviceDto), {
                propagateControls: true,
                origin: DeviceUpdateOrigin.Device,
            });
            const dto = mockDevicesService.updateDevice.mock.calls[0][1];
            expect(dto.measurements).toEqual({ temperature: 25, humidity: 60 });
        });

        it('should map the incoming measurements using the device config', async () => {
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockResolvedValue(mockDevice);
            mockDeviceConfigsMapper.mapPayloadFromDevice.mockResolvedValue({ temperature: 25 });

            await service.handleEsp32DeviceMeasurementsUpdate('device-uuid-123', { temp: 25 });

            expect(mockDeviceConfigsMapper.mapPayloadFromDevice).toHaveBeenCalledWith(mockDevice, 'measurements', { temp: 25 });
            const dto = mockDevicesService.updateDevice.mock.calls[0][1];
            expect(dto.measurements).toEqual({ temperature: 25 });
        });

        it('should skip the update when no device matches the id', async () => {
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(null);

            await service.handleEsp32DeviceMeasurementsUpdate('unknown', { temperature: 25 });

            expect(mockDevicesService.updateDevice).not.toHaveBeenCalled();
            expect(mockDeviceConfigsMapper.mapPayloadFromDevice).not.toHaveBeenCalled();
        });

        it('should swallow errors thrown while updating measurements', async () => {
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockDevicesService.updateDevice.mockRejectedValue(new Error('Device not found'));

            await expect(service.handleEsp32DeviceMeasurementsUpdate('device-uuid-123', { temperature: 25 })).resolves.toBeUndefined();
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
