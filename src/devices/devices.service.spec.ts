import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DevicesService } from './devices.service';
import { DEVICE_MODEL_PROVIDER_NAME } from './devices.constants';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { Device, DeviceBrand, DeviceType, Room } from './interfaces';
import { DeviceControlsUpdatedEvent, DeviceMeasurementsUpdatedEvent } from './events';
import { CreateDeviceDto, UpdateDeviceDto, GetDevicesDto } from './dto';

describe('DevicesService', () => {
    let service: DevicesService;
    let mockDeviceModel: {
        find: jest.Mock;
        findOne: jest.Mock;
        countDocuments: jest.Mock;
        deleteOne: jest.Mock;
        new: jest.Mock;
    };
    let mockControlServiceFactory: { getControlService: jest.Mock };
    let mockEventEmitter: { emit: jest.Mock };

    const mockDevice: Partial<Device> = {
        _id: 'mongo-id-123',
        externalId: 'device-uuid-123',
        name: 'Test Device',
        type: DeviceType.LED,
        brand: DeviceBrand.Tuya,
        room: Room.LivingRoom,
        ip: '192.168.1.100',
        controls: { on: false, brightness: 100 },
        measurements: { power: 10 },
        save: jest.fn(),
    };

    const mockControlService = {
        mergeValidateControls: jest.fn(),
        setControls: jest.fn(),
    };

    beforeEach(async () => {
        const MockDeviceModel = jest.fn().mockImplementation(function (data) {
            return {
                ...mockDevice,
                ...data,
                save: jest.fn().mockResolvedValue({ ...mockDevice, ...data }),
            };
        }) as jest.Mock & {
            find: jest.Mock;
            findOne: jest.Mock;
            countDocuments: jest.Mock;
            deleteOne: jest.Mock;
        };
        MockDeviceModel.find = jest.fn();
        MockDeviceModel.findOne = jest.fn();
        MockDeviceModel.countDocuments = jest.fn();
        MockDeviceModel.deleteOne = jest.fn();

        mockDeviceModel = MockDeviceModel as unknown as typeof mockDeviceModel;
        mockControlServiceFactory = { getControlService: jest.fn().mockReturnValue(mockControlService) };
        mockEventEmitter = { emit: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DevicesService,
                {
                    provide: DEVICE_MODEL_PROVIDER_NAME,
                    useValue: mockDeviceModel,
                },
                {
                    provide: DEVICES_CONTROL_FACTORY_PROVIDER,
                    useValue: mockControlServiceFactory,
                },
                {
                    provide: EventEmitter2,
                    useValue: mockEventEmitter,
                },
            ],
        }).compile();

        service = module.get<DevicesService>(DevicesService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getControlService', () => {
        it('should return control service from factory', () => {
            const result = service.getControlService(mockDevice as Device);

            expect(result).toBe(mockControlService);
            expect(mockControlServiceFactory.getControlService).toHaveBeenCalledWith(mockDevice);
        });
    });

    describe('getDevices', () => {
        it('should return paginated devices', async () => {
            const devices = [mockDevice, { ...mockDevice, externalId: 'device-2' }];
            mockDeviceModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(devices),
                    }),
                }),
            });
            mockDeviceModel.countDocuments.mockResolvedValue(2);

            const options = new GetDevicesDto();
            options.page = 1;
            options.pageSize = 10;

            const result = await service.getDevices(options);

            expect(result.devices).toEqual(devices);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(10);
            expect(result.totalPages).toBe(1);
        });

        it('should calculate total pages correctly', async () => {
            mockDeviceModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            mockDeviceModel.countDocuments.mockResolvedValue(25);

            const options = new GetDevicesDto();
            options.page = 1;
            options.pageSize = 10;

            const result = await service.getDevices(options);

            expect(result.totalPages).toBe(3);
        });

        it('should use default options when not provided', async () => {
            mockDeviceModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            mockDeviceModel.countDocuments.mockResolvedValue(0);

            const result = await service.getDevices();

            expect(result.devices).toEqual([]);
        });
    });

    describe('getDeviceByExternalId', () => {
        it('should return device when found', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });

            const result = await service.getDeviceByExternalId('device-uuid-123');

            expect(result).toEqual(mockDevice);
            expect(mockDeviceModel.findOne).toHaveBeenCalledWith({ externalId: 'device-uuid-123' });
        });

        it('should throw NotFoundException when device not found with strict mode', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.getDeviceByExternalId('nonexistent')).rejects.toThrow(NotFoundException);
        });

        it('should return null when device not found with non-strict mode', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const result = await service.getDeviceByExternalId('nonexistent', { strict: false });

            expect(result).toBeNull();
        });
    });

    describe('getDeviceByIp', () => {
        it('should return device by IP address', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });

            const result = await service.getDeviceByIp('192.168.1.100');

            expect(result).toEqual(mockDevice);
            expect(mockDeviceModel.findOne).toHaveBeenCalledWith({ ip: '192.168.1.100' });
        });
    });

    describe('addDevice', () => {
        it('should create new device when name does not exist', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
            mockControlService.mergeValidateControls.mockResolvedValue({ on: true });

            const createDto: CreateDeviceDto = {
                name: 'New Device',
                type: DeviceType.LED,
                brand: DeviceBrand.Tuya,
                room: Room.Bedroom,
                controls: { on: true },
            } as CreateDeviceDto;

            const result = await service.addDevice(createDto);

            expect(result.name).toBe('New Device');
        });

        it('should throw BadRequestException when device with same name exists', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });

            const createDto: CreateDeviceDto = {
                name: 'Test Device',
                type: DeviceType.LED,
                brand: DeviceBrand.Tuya,
            } as CreateDeviceDto;

            await expect(service.addDevice(createDto)).rejects.toThrow(BadRequestException);
            await expect(service.addDevice(createDto)).rejects.toThrow("Device with the same name ('Test Device') already exists");
        });
    });

    describe('updateDevice', () => {
        it('should update device and emit controls event when controls updated', async () => {
            const deviceWithSave = {
                ...mockDevice,
                save: jest.fn().mockResolvedValue({ ...mockDevice, controls: { on: true } }),
            };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });
            mockControlService.mergeValidateControls.mockResolvedValue({ on: true });

            const updateDto = new UpdateDeviceDto({ controls: { on: true } });

            await service.updateDevice('device-uuid-123', updateDto);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceControlsUpdatedEvent.eventName,
                expect.any(DeviceControlsUpdatedEvent),
            );
        });

        it('should update device and emit measurements event when measurements updated', async () => {
            const deviceWithSave = {
                ...mockDevice,
                save: jest.fn().mockResolvedValue({ ...mockDevice, measurements: { temperature: 25 } }),
            };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });

            const updateDto = new UpdateDeviceDto({ measurements: { temperature: 25 } });

            await service.updateDevice('device-uuid-123', updateDto);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceMeasurementsUpdatedEvent.eventName,
                expect.any(DeviceMeasurementsUpdatedEvent),
            );
        });

        it('should not emit events when controls/measurements not marked as updated', async () => {
            const deviceWithSave = {
                ...mockDevice,
                save: jest.fn().mockResolvedValue(mockDevice),
            };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });

            const updateDto = new UpdateDeviceDto({ name: 'Updated Name' });

            await service.updateDevice('device-uuid-123', updateDto);

            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException when device not found', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.updateDevice('nonexistent', new UpdateDeviceDto({}))).rejects.toThrow(NotFoundException);
        });
    });

    describe('removeDevice', () => {
        it('should delete device and return it', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });
            mockDeviceModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });

            const result = await service.removeDevice('device-uuid-123');

            expect(result).toEqual(mockDevice);
            expect(mockDeviceModel.deleteOne).toHaveBeenCalledWith({ _id: mockDevice._id });
        });

        it('should throw NotFoundException when device not found', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.removeDevice('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });
});
