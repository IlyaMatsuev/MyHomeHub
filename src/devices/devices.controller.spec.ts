import { Test, TestingModule } from '@nestjs/testing';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { MqttService } from 'mqtt/mqtt.service';
import { Device, DeviceBrand, DeviceType, Room } from './interfaces';
import { CreateDeviceDto, GetDevicesDto, UpdateDeviceDto } from './dto';

describe('DevicesController', () => {
    let controller: DevicesController;
    let mockDevicesService: {
        getDevices: jest.Mock;
        getDeviceByExternalId: jest.Mock;
        getDevice: jest.Mock;
        addDevice: jest.Mock;
        updateDevice: jest.Mock;
        removeDevice: jest.Mock;
    };
    let mockMqttService: {
        setZigbeePermitJoin: jest.Mock;
        renameZigbeeDevice: jest.Mock;
        removeZigbeeDevice: jest.Mock;
    };

    const mockDevice: Partial<Device> = {
        _id: 'mongo-id-123',
        externalId: 'device-uuid-123',
        name: 'Test Device',
        type: DeviceType.LED,
        brand: DeviceBrand.Tuya,
        room: Room.LivingRoom,
        controls: { on: false },
    };

    beforeEach(async () => {
        mockDevicesService = {
            getDevices: jest.fn(),
            getDeviceByExternalId: jest.fn(),
            getDevice: jest.fn(),
            addDevice: jest.fn(),
            updateDevice: jest.fn(),
            removeDevice: jest.fn(),
        };
        mockMqttService = {
            setZigbeePermitJoin: jest.fn(),
            renameZigbeeDevice: jest.fn(),
            removeZigbeeDevice: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DevicesController],
            providers: [
                {
                    provide: DevicesService,
                    useValue: mockDevicesService,
                },
                {
                    provide: MqttService,
                    useValue: mockMqttService,
                },
            ],
        }).compile();

        controller = module.get<DevicesController>(DevicesController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getDevices', () => {
        it('should return paginated devices', async () => {
            const devicesPage = {
                devices: [mockDevice],
                page: 1,
                pageSize: 10,
                totalPages: 1,
            };
            mockDevicesService.getDevices.mockResolvedValue(devicesPage);

            const query = new GetDevicesDto();
            const result = await controller.getDevices(query);

            expect(result).toEqual(devicesPage);
            expect(mockDevicesService.getDevices).toHaveBeenCalledWith(query);
        });
    });

    describe('getDevice', () => {
        it('should return device by external ID', async () => {
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);

            const result = await controller.getDevice('device-uuid-123');

            expect(result).toEqual(mockDevice);
            expect(mockDevicesService.getDeviceByExternalId).toHaveBeenCalledWith('device-uuid-123');
        });
    });

    describe('addDevice', () => {
        it('should create and return new device', async () => {
            mockDevicesService.addDevice.mockResolvedValue(mockDevice);

            const createDto: CreateDeviceDto = {
                name: 'Test Device',
                type: DeviceType.LED,
                brand: DeviceBrand.Tuya,
                room: Room.LivingRoom,
            } as CreateDeviceDto;

            const result = await controller.addDevice(createDto);

            expect(result).toEqual(mockDevice);
            expect(mockDevicesService.addDevice).toHaveBeenCalledWith(createDto);
        });
    });

    describe('updateDevice', () => {
        it('should update and return device', async () => {
            const updatedDevice = { ...mockDevice, name: 'Updated Device' };
            mockDevicesService.updateDevice.mockResolvedValue(updatedDevice);

            const updateDto = new UpdateDeviceDto({ name: 'Updated Device' });
            const result = await controller.updateDevice('device-uuid-123', updateDto);

            expect(result).toEqual(updatedDevice);
            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith('device-uuid-123', updateDto);
        });
    });

    describe('removeDevice', () => {
        it('should delete and return device', async () => {
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(mockDevice);
            mockDevicesService.removeDevice.mockResolvedValue(mockDevice);

            const result = await controller.removeDevice('device-uuid-123');

            expect(result).toEqual(mockDevice);
            expect(mockDevicesService.removeDevice).toHaveBeenCalledWith('device-uuid-123');
        });

        it('should remove Philips device from Z2M when deleting', async () => {
            const philipsDevice = {
                ...mockDevice,
                brand: DeviceBrand.Philips,
                zigbeeIeeeAddress: '0x00158d0001234567',
            };
            mockDevicesService.getDeviceByExternalId.mockResolvedValue(philipsDevice);
            mockDevicesService.removeDevice.mockResolvedValue(philipsDevice);

            await controller.removeDevice('device-uuid-123');

            expect(mockMqttService.removeZigbeeDevice).toHaveBeenCalledWith('0x00158d0001234567');
        });
    });

    describe('zigbeePermitJoin', () => {
        it('should enable permit join', async () => {
            await controller.zigbeePermitJoin({ enable: true, seconds: 60 });

            expect(mockMqttService.setZigbeePermitJoin).toHaveBeenCalledWith(true, 60);
        });

        it('should disable permit join', async () => {
            await controller.zigbeePermitJoin({ enable: false });

            expect(mockMqttService.setZigbeePermitJoin).toHaveBeenCalledWith(false, undefined);
        });
    });

    describe('zigbeeRename', () => {
        it('should rename Philips device and update local device', async () => {
            const philipsDevice = {
                ...mockDevice,
                brand: DeviceBrand.Philips,
                zigbeeIeeeAddress: '0x00158d0001234567',
                zigbeeFriendlyName: 'old_name',
            };
            mockDevicesService.getDevice.mockResolvedValue(philipsDevice);
            mockDevicesService.updateDevice.mockResolvedValue({
                ...philipsDevice,
                zigbeeFriendlyName: 'new_name',
            });

            await controller.zigbeeRename({
                ieeeAddress: '0x00158d0001234567',
                friendlyName: 'new_name',
            });

            expect(mockMqttService.renameZigbeeDevice).toHaveBeenCalledWith('0x00158d0001234567', 'new_name');
            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith(
                'device-uuid-123',
                expect.objectContaining({ zigbeeFriendlyName: 'new_name' }),
            );
        });
    });
});
