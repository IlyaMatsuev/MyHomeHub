import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DevicesService } from './devices.service';
import { DEVICE_MODEL_PROVIDER_NAME } from './devices.constants';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { Device, DeviceBrand, DeviceType, Room } from './interfaces';
import { DeviceCommandExecutedEvent, DeviceUpdateCompletedEvent, DeviceUpdateRequestedEvent } from './events';
import { CreateDeviceDto, UpdateDeviceDto, GetDevicesDto, GetPairableDevicesDto } from './dto';
import { ZigbeeService } from 'zigbee/zigbee.service';
import { PairableDevice } from 'zigbee/interfaces';
import { ZigbeePairableDevices } from 'zigbee/store';

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
    let mockZigbeeService: {
        setPermitJoin: jest.Mock;
        renameDevice: jest.Mock;
        removeZigbeeDevice: jest.Mock;
    };
    let hasSpy: jest.SpyInstance;
    let getSpy: jest.SpyInstance;
    let getAllSpy: jest.SpyInstance;

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
        validateControls: jest.fn(),
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
        mockZigbeeService = {
            setPermitJoin: jest.fn(),
            renameDevice: jest.fn().mockResolvedValue(undefined),
            removeZigbeeDevice: jest.fn().mockResolvedValue(undefined),
        };
        hasSpy = jest.spyOn(ZigbeePairableDevices, 'has').mockReturnValue(false);
        getSpy = jest.spyOn(ZigbeePairableDevices, 'get').mockReturnValue(null);
        getAllSpy = jest.spyOn(ZigbeePairableDevices, 'getAll').mockReturnValue([]);

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
                {
                    provide: ZigbeeService,
                    useValue: mockZigbeeService,
                },
            ],
        }).compile();

        service = module.get<DevicesService>(DevicesService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getControlService', () => {
        it('should return control service from factory', () => {
            const result = service.getControlService(mockDevice as Device);

            expect(result).toBe(mockControlService);
            expect(mockControlServiceFactory.getControlService).toHaveBeenCalledWith(mockDevice);
        });
    });

    describe('onDeviceUpdated', () => {
        it('should update the matched device with the event payload', async () => {
            const matchedDevice = { ...mockDevice } as Device;
            const getDeviceSpy = jest.spyOn(service, 'getDevice').mockResolvedValue(matchedDevice);
            const updateDeviceSpy = jest.spyOn(service, 'updateDevice').mockResolvedValue(matchedDevice);

            const event = new DeviceUpdateRequestedEvent({ ip: '192.168.1.100' }, new UpdateDeviceDto({ controls: { on: true } }));
            await service.onDeviceUpdated(event);

            expect(getDeviceSpy).toHaveBeenCalledWith({ ip: '192.168.1.100' }, { strict: false });
            expect(updateDeviceSpy).toHaveBeenCalledWith(mockDevice.externalId, event.update);
        });

        it('should warn and not update when no device matches the selector', async () => {
            jest.spyOn(service, 'getDevice').mockResolvedValue(null);
            const updateDeviceSpy = jest.spyOn(service, 'updateDevice');
            const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

            await service.onDeviceUpdated(new DeviceUpdateRequestedEvent({ externalId: 'missing' }, new UpdateDeviceDto({})));

            expect(updateDeviceSpy).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No device matched DeviceUpdatedEvent selector'));
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

            const result = await service.getDevices({}, options);

            expect(result.items).toEqual(devices);
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

            const result = await service.getDevices({}, options);

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

            expect(result.items).toEqual([]);
        });

        it('should filter devices by room from options when provided', async () => {
            const devices = [mockDevice];
            mockDeviceModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(devices),
                    }),
                }),
            });
            mockDeviceModel.countDocuments.mockResolvedValue(1);

            const options = new GetDevicesDto();
            options.room = Room.LivingRoom;

            const result = await service.getDevices({}, options);

            expect(result.items).toEqual(devices);
            expect(mockDeviceModel.find).toHaveBeenCalledWith({ room: Room.LivingRoom });
            expect(mockDeviceModel.countDocuments).toHaveBeenCalledWith({ room: Room.LivingRoom });
        });

        it('should filter devices by filter parameter', async () => {
            const devices = [mockDevice];
            mockDeviceModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(devices),
                    }),
                }),
            });
            mockDeviceModel.countDocuments.mockResolvedValue(1);

            const result = await service.getDevices({ room: Room.LivingRoom });

            expect(result.items).toEqual(devices);
            expect(mockDeviceModel.find).toHaveBeenCalledWith({ room: Room.LivingRoom });
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

    describe('getDeviceByZigbeeFriendlyName', () => {
        it('should return device by zigbee friendly name', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });

            const result = await service.getDeviceByZigbeeFriendlyName('living_room_bulb');

            expect(result).toEqual(mockDevice);
            expect(mockDeviceModel.findOne).toHaveBeenCalledWith({ zigbeeFriendlyName: 'living_room_bulb' });
        });

        it('should return null without throwing when no device matches', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.getDeviceByZigbeeFriendlyName('unknown')).resolves.toBeNull();
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

        it('should throw BadRequestException when zigbeeIeeeAddress is not currently pairable', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
            hasSpy.mockReturnValue(false);

            const createDto: CreateDeviceDto = {
                name: 'Zigbee Device',
                type: DeviceType.LED,
                brand: DeviceBrand.Philips,
                zigbeeIeeeAddress: '0xnotpairable',
                zigbeeFriendlyName: 'living_room',
            } as CreateDeviceDto;

            await expect(service.addDevice(createDto)).rejects.toThrow(BadRequestException);
            await expect(service.addDevice(createDto)).rejects.toThrow(
                "Device with the provided zigbee Ieee ('0xnotpairable') is not discoverable. Make sure it's pairable first",
            );
            expect(mockZigbeeService.renameDevice).not.toHaveBeenCalled();
        });

        it('should rename zigbee device after creation when friendly name is set', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
            mockControlService.mergeValidateControls.mockResolvedValue({ on: true });
            hasSpy.mockReturnValue(true);

            const createDto: CreateDeviceDto = {
                name: 'Zigbee Bulb',
                type: DeviceType.LED,
                brand: DeviceBrand.Philips,
                zigbeeIeeeAddress: '0xpairable',
                zigbeeFriendlyName: 'living_room',
                controls: { on: true },
            } as CreateDeviceDto;

            await service.addDevice(createDto);

            expect(hasSpy).toHaveBeenCalledWith('0xpairable');
            expect(mockZigbeeService.renameDevice).toHaveBeenCalledWith('0xpairable', 'living_room');
        });

        it('should not call zigbeeService.renameDevice for non-zigbee devices', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
            mockControlService.mergeValidateControls.mockResolvedValue({ on: true });

            const createDto: CreateDeviceDto = {
                name: 'Tuya Plug',
                type: DeviceType.Plug,
                brand: DeviceBrand.Tuya,
                controls: { on: true },
            } as CreateDeviceDto;

            await service.addDevice(createDto);

            expect(mockZigbeeService.renameDevice).not.toHaveBeenCalled();
        });
    });

    describe('updateDevice', () => {
        it('should push the merged controls to the device and persist the update', async () => {
            const save = jest.fn().mockResolvedValue(undefined);
            const deviceWithSave = { ...mockDevice, save };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });
            mockControlService.mergeValidateControls.mockResolvedValue({ on: true });

            await service.updateDevice('device-uuid-123', new UpdateDeviceDto({ controls: { on: true } }));

            expect(mockControlService.setControls).toHaveBeenCalledWith({ on: true });
            expect(save).toHaveBeenCalledWith({ validateBeforeSave: true });
        });

        it('should emit a single DeviceUpdateCompletedEvent flagging controls as updated', async () => {
            const deviceWithSave = { ...mockDevice, save: jest.fn().mockResolvedValue(undefined) };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });
            mockControlService.mergeValidateControls.mockResolvedValue({ on: true });

            await service.updateDevice('device-uuid-123', new UpdateDeviceDto({ controls: { on: true } }));

            // A single Zigbee message can carry both a control and measurements; emitting one event
            // (instead of separate controls/measurements events) is what prevents scenarios from
            // being triggered twice per update.
            expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceUpdateCompletedEvent.eventName,
                expect.objectContaining({
                    deviceExternalId: 'device-uuid-123',
                    controlsUpdated: true,
                    measurementsUpdated: false,
                }),
            );
        });

        it('should not push controls to the device for measurement-only updates', async () => {
            const deviceWithSave = { ...mockDevice, save: jest.fn().mockResolvedValue(undefined) };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });
            mockControlService.setControls.mockClear();

            await service.updateDevice('device-uuid-123', new UpdateDeviceDto({ measurements: { temperature: 25 } }));

            expect(mockControlService.setControls).not.toHaveBeenCalled();
        });

        it('should emit DeviceUpdateCompletedEvent flagging measurements as updated', async () => {
            const deviceWithSave = { ...mockDevice, save: jest.fn().mockResolvedValue(undefined) };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });

            await service.updateDevice('device-uuid-123', new UpdateDeviceDto({ measurements: { temperature: 25 } }));

            expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceUpdateCompletedEvent.eventName,
                expect.objectContaining({
                    deviceExternalId: 'device-uuid-123',
                    controlsUpdated: false,
                    measurementsUpdated: true,
                }),
            );
        });

        it('should flag both controls and measurements as updated when both change in one update', async () => {
            const deviceWithSave = { ...mockDevice, save: jest.fn().mockResolvedValue(undefined) };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });
            mockControlService.mergeValidateControls.mockResolvedValue({ action: 'off_press' });

            const updateDto = new UpdateDeviceDto({ controls: { action: 'off_press' }, measurements: { battery: 100 } });
            await service.updateDevice('device-uuid-123', updateDto);

            expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceUpdateCompletedEvent.eventName,
                expect.objectContaining({ controlsUpdated: true, measurementsUpdated: true }),
            );
        });

        it('should still emit DeviceUpdateCompletedEvent with both flags false for metadata-only updates', async () => {
            const deviceWithSave = { ...mockDevice, save: jest.fn().mockResolvedValue(undefined) };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });

            await service.updateDevice('device-uuid-123', new UpdateDeviceDto({ name: 'Updated Name' }));

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceUpdateCompletedEvent.eventName,
                expect.objectContaining({ controlsUpdated: false, measurementsUpdated: false }),
            );
        });

        it('should throw NotFoundException when device not found', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.updateDevice('nonexistent', new UpdateDeviceDto({}))).rejects.toThrow(NotFoundException);
        });

        it('should rename zigbee device when friendly name changes', async () => {
            const deviceWithSave = {
                ...mockDevice,
                zigbeeIeeeAddress: '0xpairable',
                zigbeeFriendlyName: 'old_name',
                save: jest.fn().mockResolvedValue({
                    ...mockDevice,
                    zigbeeIeeeAddress: '0xpairable',
                    zigbeeFriendlyName: 'new_name',
                }),
            };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });
            getSpy.mockReturnValue({
                zigbeeIeeeAddress: '0xpairable',
                zigbeeFriendlyName: 'old_name',
            });

            const updateDto = new UpdateDeviceDto({
                zigbeeFriendlyName: 'new_name',
            });

            await service.updateDevice('device-uuid-123', updateDto);

            expect(mockZigbeeService.renameDevice).toHaveBeenCalledWith('0xpairable', 'new_name');
        });

        it('should not rename zigbee device when friendly name is unchanged', async () => {
            const deviceWithSave = {
                ...mockDevice,
                zigbeeIeeeAddress: '0xpairable',
                zigbeeFriendlyName: 'same_name',
                save: jest.fn().mockResolvedValue({
                    ...mockDevice,
                    zigbeeIeeeAddress: '0xpairable',
                    zigbeeFriendlyName: 'same_name',
                }),
            };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });
            getSpy.mockReturnValue({
                zigbeeIeeeAddress: '0xpairable',
                zigbeeFriendlyName: 'same_name',
            });

            const updateDto = new UpdateDeviceDto({
                zigbeeFriendlyName: 'same_name',
            });

            await service.updateDevice('device-uuid-123', updateDto);

            expect(mockZigbeeService.renameDevice).not.toHaveBeenCalled();
        });
    });

    describe('sendCommand', () => {
        it('should send command to device without saving state', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });
            mockControlService.validateControls.mockResolvedValue({ action: 'on_press' });

            const command = { action: 'on_press' };
            const result = await service.sendCommand('device-uuid-123', command);

            expect(result).toEqual(mockDevice);
            expect(mockControlService.validateControls).toHaveBeenCalledWith(command);
            expect(mockControlService.setControls).toHaveBeenCalledWith({ action: 'on_press' });
        });

        it('should emit DeviceCommandExecutedEvent with command payload', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });
            mockControlService.validateControls.mockResolvedValue({ action: 'on_press' });

            await service.sendCommand('device-uuid-123', { action: 'on_press' });

            expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceCommandExecutedEvent.eventName,
                expect.objectContaining({
                    deviceExternalId: 'device-uuid-123',
                    commands: { action: 'on_press' },
                }),
            );
        });

        it('should not emit DeviceUpdateCompletedEvent', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });
            mockControlService.validateControls.mockResolvedValue({ action: 'on_press' });

            await service.sendCommand('device-uuid-123', { action: 'on_press' });

            expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(DeviceUpdateCompletedEvent.eventName, expect.anything());
        });

        it('should throw NotFoundException when device not found', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.sendCommand('nonexistent', { action: 'on_press' })).rejects.toThrow(NotFoundException);
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

        it('should remove zigbee device via zigbeeService when device has zigbeeIeeeAddress', async () => {
            const zigbeeDevice = { ...mockDevice, zigbeeIeeeAddress: '0xremoveme' };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(zigbeeDevice),
            });
            mockDeviceModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });

            await service.removeDevice('device-uuid-123');

            expect(mockZigbeeService.removeZigbeeDevice).toHaveBeenCalledWith('0xremoveme');
        });

        it('should not call zigbeeService.removeZigbeeDevice for non-zigbee devices', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });
            mockDeviceModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });

            await service.removeDevice('device-uuid-123');

            expect(mockZigbeeService.removeZigbeeDevice).not.toHaveBeenCalled();
        });
    });

    describe('toggleDevicePairingMode', () => {
        it('should enable pairing mode with provided timeout', () => {
            const result = service.toggleDevicePairingMode(true, 60);

            expect(mockZigbeeService.setPermitJoin).toHaveBeenCalledWith(true, 60);
            expect(result).toEqual({ enabled: true, timeout: 60 });
        });

        it('should disable pairing mode and zero out the returned timeout', () => {
            const result = service.toggleDevicePairingMode(false, 60);

            expect(mockZigbeeService.setPermitJoin).toHaveBeenCalledWith(false, 60);
            expect(result).toEqual({ enabled: false, timeout: 0 });
        });
    });

    describe('getPairableDevices', () => {
        it('should return an empty page when no devices are cached', async () => {
            getAllSpy.mockReturnValue([]);

            const result = await service.getPairableDevices();

            expect(result.items).toEqual([]);
            expect(result.totalPages).toBe(0);
            expect(mockDeviceModel.find).not.toHaveBeenCalled();
        });

        it('should exclude devices that are already registered', async () => {
            getAllSpy.mockReturnValue([
                { zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' },
                { zigbeeIeeeAddress: '0x002', zigbeeFriendlyName: 'bulb_b' },
                { zigbeeIeeeAddress: '0x003', zigbeeFriendlyName: 'bulb_c' },
            ]);
            mockDeviceModel.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue([{ zigbeeIeeeAddress: '0x002' }]),
            });

            const result = await service.getPairableDevices();

            expect(mockDeviceModel.find).toHaveBeenCalledWith(
                { zigbeeIeeeAddress: { $in: ['0x001', '0x002', '0x003'] } },
                { zigbeeIeeeAddress: 1 },
            );
            expect(result.items.map(d => d.zigbeeIeeeAddress)).toEqual(['0x001', '0x003']);
            expect(result.totalPages).toBe(1);
        });

        it('should paginate the pairable devices', async () => {
            const entries: Array<PairableDevice> = Array.from({ length: 25 }, (_, i) => {
                const ieee = `0x${i.toString().padStart(3, '0')}`;
                return { zigbeeIeeeAddress: ieee, zigbeeFriendlyName: `bulb_${i}` };
            });
            getAllSpy.mockReturnValue(entries);
            mockDeviceModel.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
            });

            const options = new GetPairableDevicesDto();
            options.page = 2;
            options.pageSize = 10;

            const result = await service.getPairableDevices(options);

            expect(result.items).toHaveLength(10);
            expect(result.items[0].zigbeeIeeeAddress).toBe('0x010');
            expect(result.items[9].zigbeeIeeeAddress).toBe('0x019');
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(10);
            expect(result.totalPages).toBe(3);
        });
    });
});
