import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FieldValidationException } from 'common/exceptions';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DevicesService } from './devices.service';
import { DEVICE_MODEL_PROVIDER_NAME } from './devices.constants';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { Device, DeviceBrand, DeviceType, DeviceUpdateOrigin, Room } from './interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceCommandExecutedEvent, DeviceUpdateCompletedEvent, DeviceUpdateRequestedEvent } from './events';
import { CreateDeviceDto, UpdateDeviceDto, GetDeviceDto, GetDevicesDto, GetPairableDevicesDto } from './dto';
import { ZigbeeService } from 'zigbee/zigbee.service';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import { DeviceConfigItemType, DeviceConfigValidationPolicy } from 'device-configs/interfaces';
import { DeviceConfigsChangedEvent } from 'device-configs/events';
import { PairableDevice } from 'zigbee/interfaces';
import { ZigbeePairableDevices } from 'zigbee/store';

describe('DevicesService', () => {
    let service: DevicesService;
    let mockDeviceModel: {
        find: jest.Mock;
        findOne: jest.Mock;
        countDocuments: jest.Mock;
        deleteOne: jest.Mock;
        bulkWrite: jest.Mock;
        new: jest.Mock;
    };
    let mockControlServiceFactory: { getControlService: jest.Mock };
    let mockEventEmitter: { emit: jest.Mock };
    let mockZigbeeService: {
        setPermitJoin: jest.Mock;
        renameDevice: jest.Mock;
        removeZigbeeDevice: jest.Mock;
    };
    let mockDeviceConfigsService: { getConfig: jest.Mock; getConfigs: jest.Mock };
    let hasSpy: jest.SpyInstance;
    let getSpy: jest.SpyInstance;
    let getAllSpy: jest.SpyInstance;

    const mockDevice: Partial<Device> = {
        _id: 'mongo-id-123',
        externalId: 'device-uuid-123',
        name: 'Test Device',
        type: DeviceType.LED,
        brand: DeviceBrand.Tuya,
        transportProtocol: TransportProtocol.Tuya,
        room: Room.LivingRoom,
        ip: '192.168.1.100',
        controls: { on: false, brightness: 100 },
        measurements: { power: 10 },
        save: jest.fn(),
    };

    const mockControlService = {
        mergeValidateControls: jest.fn(),
        mergeValidateMeasurements: jest.fn(),
        validateCommand: jest.fn(),
        applyConfigDefaults: jest.fn(),
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
            bulkWrite: jest.Mock;
        };
        MockDeviceModel.find = jest.fn();
        MockDeviceModel.findOne = jest.fn();
        MockDeviceModel.countDocuments = jest.fn();
        MockDeviceModel.deleteOne = jest.fn();
        MockDeviceModel.bulkWrite = jest.fn().mockResolvedValue({ modifiedCount: 1 });

        mockDeviceModel = MockDeviceModel as unknown as typeof mockDeviceModel;
        mockControlServiceFactory = { getControlService: jest.fn().mockReturnValue(mockControlService) };
        mockEventEmitter = { emit: jest.fn() };
        mockZigbeeService = {
            setPermitJoin: jest.fn(),
            renameDevice: jest.fn().mockResolvedValue(undefined),
            removeZigbeeDevice: jest.fn().mockResolvedValue(undefined),
        };
        mockDeviceConfigsService = {
            getConfig: jest.fn().mockResolvedValue(null),
            getConfigs: jest.fn().mockResolvedValue([]),
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
                {
                    provide: DeviceConfigsService,
                    useValue: mockDeviceConfigsService,
                },
            ],
        }).compile();

        service = module.get<DevicesService>(DevicesService);
        mockControlService.mergeValidateMeasurements.mockImplementation(measurements => Promise.resolve(measurements));
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
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(matchedDevice),
            });
            const updateDeviceSpy = jest.spyOn(service, 'updateDevice').mockResolvedValue(matchedDevice);

            const event = new DeviceUpdateRequestedEvent({ ip: '192.168.1.100' }, new UpdateDeviceDto({ controls: { on: true } }));
            await service.onDeviceUpdated(event);

            expect(mockDeviceModel.findOne).toHaveBeenCalledWith({ ip: '192.168.1.100' });
            expect(updateDeviceSpy).toHaveBeenCalledWith(mockDevice.externalId, event.update, {
                propagateControls: event.propagate,
                origin: DeviceUpdateOrigin.Api,
            });
        });

        it('should forward the propagate flag from the event to the update', async () => {
            const matchedDevice = { ...mockDevice } as Device;
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(matchedDevice),
            });
            const updateDeviceSpy = jest.spyOn(service, 'updateDevice').mockResolvedValue(matchedDevice);

            const event = new DeviceUpdateRequestedEvent(
                { externalId: mockDevice.externalId },
                new UpdateDeviceDto({ controls: { on: true } }),
                false,
            );
            await service.onDeviceUpdated(event);

            expect(updateDeviceSpy).toHaveBeenCalledWith(mockDevice.externalId, event.update, {
                propagateControls: false,
                origin: DeviceUpdateOrigin.Api,
            });
        });

        it('should resolve the device by its zigbee friendly name selector', async () => {
            // Zigbee renames arrive with only the previous friendly name to match on.
            const matchedDevice = { ...mockDevice } as Device;
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(matchedDevice),
            });
            const updateDeviceSpy = jest.spyOn(service, 'updateDevice').mockResolvedValue(matchedDevice);

            const event = new DeviceUpdateRequestedEvent(
                { zigbeeFriendlyName: 'old_name' },
                new UpdateDeviceDto({ zigbeeFriendlyName: 'new_name' }),
            );
            await service.onDeviceUpdated(event);

            expect(mockDeviceModel.findOne).toHaveBeenCalledWith({ zigbeeFriendlyName: 'old_name' });
            expect(updateDeviceSpy).toHaveBeenCalledWith(mockDevice.externalId, event.update, {
                propagateControls: event.propagate,
                origin: DeviceUpdateOrigin.Api,
            });
        });

        it('should warn and not update when no device matches the selector', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
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

        it('should attach device configs when includeConfig is true', async () => {
            const devices = [mockDevice, { ...mockDevice, externalId: 'device-2', brand: DeviceBrand.Shelly }];
            mockDeviceModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(devices),
                    }),
                }),
            });
            mockDeviceModel.countDocuments.mockResolvedValue(2);
            mockDeviceConfigsService.getConfigs.mockResolvedValue([
                {
                    brand: mockDevice.brand,
                    type: mockDevice.type,
                    transportProtocol: mockDevice.transportProtocol,
                    controls: [{ label: 'On', name: 'on', type: 'boolean' }],
                },
            ]);

            const options = new GetDevicesDto();
            options.includeConfig = true;

            const result = await service.getDevices({}, options);

            expect(mockDeviceConfigsService.getConfigs).toHaveBeenCalledWith([
                { brand: mockDevice.brand, type: mockDevice.type, transportProtocol: mockDevice.transportProtocol },
                { brand: DeviceBrand.Shelly, type: mockDevice.type, transportProtocol: mockDevice.transportProtocol },
            ]);
            expect(result.items[0].config).toEqual({ controls: [{ label: 'On', name: 'on', type: 'boolean' }] });
            expect(result.items[1].config).toBeUndefined();
        });

        it('should not fetch device configs when includeConfig is not set', async () => {
            mockDeviceModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });
            mockDeviceModel.countDocuments.mockResolvedValue(1);

            await service.getDevices({}, new GetDevicesDto());

            expect(mockDeviceConfigsService.getConfigs).not.toHaveBeenCalled();
        });
    });

    describe('getAllDevices', () => {
        const mockGetDevicesPage = (items: Array<Partial<Device>>, totalItems: number) => {
            mockDeviceModel.find.mockReturnValueOnce({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(items),
                    }),
                }),
            });
            mockDeviceModel.countDocuments.mockResolvedValueOnce(totalItems);
        };

        it('should return all devices in a single page when they fit into MAX_PAGE_SIZE', async () => {
            const devices = [mockDevice, { ...mockDevice, externalId: 'device-2' }];
            mockGetDevicesPage(devices, 2);

            const result = await service.getAllDevices();

            expect(result.items).toEqual(devices);
            expect(result.totalItems).toBe(2);
            expect(mockDeviceModel.find).toHaveBeenCalledTimes(1);
            expect(mockDeviceModel.find).toHaveBeenCalledWith({});
        });

        it('should aggregate devices across pages when totalPages > 1', async () => {
            const firstPage = Array.from({ length: 50 }, (_, i) => ({ ...mockDevice, externalId: `device-${i + 1}` }));
            const secondPage = [
                { ...mockDevice, externalId: 'device-51' },
                { ...mockDevice, externalId: 'device-52' },
            ];
            mockGetDevicesPage(firstPage, 52);
            mockGetDevicesPage(secondPage, 52);

            const result = await service.getAllDevices();

            expect(result.items).toHaveLength(52);
            expect(result.items[0].externalId).toBe('device-1');
            expect(result.items[51].externalId).toBe('device-52');
            expect(mockDeviceModel.find).toHaveBeenCalledTimes(2);
        });

        it('should pass the provided filter to every paginated query', async () => {
            mockGetDevicesPage([mockDevice], 1);

            await service.getAllDevices({ room: Room.LivingRoom });

            expect(mockDeviceModel.find).toHaveBeenCalledWith({ room: Room.LivingRoom });
            expect(mockDeviceModel.countDocuments).toHaveBeenCalledWith({ room: Room.LivingRoom });
        });

        it('should return an empty page when no devices match the filter', async () => {
            mockGetDevicesPage([], 0);

            const result = await service.getAllDevices({ room: Room.LivingRoom });

            expect(result.items).toEqual([]);
            expect(result.totalItems).toBe(0);
            expect(result.totalPages).toBe(1);
            expect(mockDeviceModel.find).toHaveBeenCalledTimes(1);
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

    describe('getDevice', () => {
        it('should return the device without config when includeConfig is not set', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });

            const result = await service.getDevice('device-uuid-123', new GetDeviceDto());

            expect(result).toEqual(mockDevice);
            expect(mockDeviceConfigsService.getConfig).not.toHaveBeenCalled();
        });

        it('should include the device config when includeConfig is true', async () => {
            const deviceWithToObject = { ...mockDevice, toObject: jest.fn().mockReturnValue(mockDevice) };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithToObject),
            });
            mockDeviceConfigsService.getConfig.mockResolvedValue({
                brand: mockDevice.brand,
                type: mockDevice.type,
                transportProtocol: mockDevice.transportProtocol,
                commands: [{ label: 'Action', name: 'action', type: 'string' }],
                controls: [],
                measurements: [],
            });

            const query = new GetDeviceDto();
            query.includeConfig = true;
            const result = await service.getDevice('device-uuid-123', query);

            expect(mockDeviceConfigsService.getConfig).toHaveBeenCalledWith({
                brand: mockDevice.brand,
                type: mockDevice.type,
                transportProtocol: mockDevice.transportProtocol,
            });
            expect(result.config).toEqual({ commands: [{ label: 'Action', name: 'action', type: 'string' }] });
        });

        it('should omit the config field when no config matches the device', async () => {
            const deviceWithToObject = { ...mockDevice, toObject: jest.fn().mockReturnValue(mockDevice) };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithToObject),
            });
            mockDeviceConfigsService.getConfig.mockResolvedValue(null);

            const query = new GetDeviceDto();
            query.includeConfig = true;
            const result = await service.getDevice('device-uuid-123', query);

            expect(result.config).toBeUndefined();
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

    describe('addDevice defaults', () => {
        beforeEach(() => {
            mockDeviceModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
            mockControlService.mergeValidateControls.mockResolvedValue({ on: true });
        });

        it('should seed the new device with the controls declared in its device config', async () => {
            await service.addDevice({ name: 'New Device', type: DeviceType.LED, brand: DeviceBrand.Shelly } as CreateDeviceDto);

            expect(mockControlService.applyConfigDefaults).toHaveBeenCalled();
        });

        it('should validate a device originated create with the sanitize policy', async () => {
            await service.addDevice(
                { name: 'New Device', type: DeviceType.Fans, brand: DeviceBrand.ESP32, controls: { on: true } } as CreateDeviceDto,
                { origin: DeviceUpdateOrigin.Device },
            );

            expect(mockControlService.mergeValidateControls).toHaveBeenCalledWith(
                { on: true },
                expect.anything(),
                DeviceConfigValidationPolicy.Sanitize,
            );
        });
    });

    describe('onDeviceConfigsChanged', () => {
        const changedConfig = {
            brand: DeviceBrand.Shelly,
            type: DeviceType.LED,
            transportProtocol: TransportProtocol.Http,
            controls: [
                { label: 'On', name: 'on', type: DeviceConfigItemType.Boolean },
                { label: 'Brightness', name: 'brightness', type: DeviceConfigItemType.Number, default: 50 },
            ],
            measurements: [],
        };

        const mockStoredDevices = (devices: Array<Partial<Device>>) => {
            mockDeviceModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(devices) });
        };

        it('should seed the newly declared items with their defaults', async () => {
            mockStoredDevices([{ _id: 'mongo-id', controls: { on: true } } as unknown as Device]);

            await service.onDeviceConfigsChanged(new DeviceConfigsChangedEvent([changedConfig]));

            expect(mockDeviceModel.bulkWrite).toHaveBeenCalledWith([
                { updateOne: { filter: { _id: 'mongo-id' }, update: { $set: { 'controls.brightness': 50 } } } },
            ]);
        });

        it('should remove the stored items the config no longer declares', async () => {
            mockStoredDevices([{ _id: 'mongo-id', controls: { on: true, brightness: 50, legacy: 'x' } } as unknown as Device]);

            await service.onDeviceConfigsChanged(new DeviceConfigsChangedEvent([changedConfig]));

            expect(mockDeviceModel.bulkWrite).toHaveBeenCalledWith([
                { updateOne: { filter: { _id: 'mongo-id' }, update: { $unset: { 'controls.legacy': '' } } } },
            ]);
        });

        it('should leave the stored payload untouched when the config does not describe the section', async () => {
            mockStoredDevices([{ _id: 'mongo-id', controls: { on: true }, measurements: { power: 10 } } as unknown as Device]);

            await service.onDeviceConfigsChanged(new DeviceConfigsChangedEvent([{ ...changedConfig, controls: [], measurements: [] }]));

            expect(mockDeviceModel.bulkWrite).not.toHaveBeenCalled();
        });

        it('should not write anything when every device already matches the config', async () => {
            mockStoredDevices([{ _id: 'mongo-id', controls: { on: true, brightness: 50 } } as unknown as Device]);

            await service.onDeviceConfigsChanged(new DeviceConfigsChangedEvent([changedConfig]));

            expect(mockDeviceModel.bulkWrite).not.toHaveBeenCalled();
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

        it('should throw FieldValidationException when device with same name exists', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });

            const createDto: CreateDeviceDto = {
                name: 'Test Device',
                type: DeviceType.LED,
                brand: DeviceBrand.Tuya,
            } as CreateDeviceDto;

            await expect(service.addDevice(createDto)).rejects.toThrow(FieldValidationException);
            await expect(service.addDevice(createDto)).rejects.toMatchObject({
                response: {
                    messages: ["Device with the same name ('Test Device') already exists"],
                    details: { errors: [{ message: "Device with the same name ('Test Device') already exists", path: 'name' }] },
                },
            });
        });

        it('should throw FieldValidationException when zigbeeIeeeAddress is not currently pairable', async () => {
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

            const expectedMessage =
                "Device with the provided zigbee Ieee ('0xnotpairable') is not discoverable. Make sure it's pairable first";
            await expect(service.addDevice(createDto)).rejects.toThrow(FieldValidationException);
            await expect(service.addDevice(createDto)).rejects.toMatchObject({
                response: {
                    messages: [expectedMessage],
                    details: { errors: [{ message: expectedMessage, path: 'zigbeeIeeeAddress' }] },
                },
            });
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

        it('should persist the controls without sending them back to the device when not propagating', async () => {
            // Devices report the state they have already applied. Pushing it back would make every external
            // change (a physical button press, the vendor app) bounce between the hub and the device.
            const save = jest.fn().mockResolvedValue(undefined);
            const deviceWithSave = { ...mockDevice, save };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });
            mockControlService.mergeValidateControls.mockResolvedValue({ on: true });
            mockControlService.setControls.mockClear();
            mockEventEmitter.emit.mockClear();

            await service.updateDevice('device-uuid-123', new UpdateDeviceDto({ controls: { on: true } }), { propagateControls: false });

            expect(mockControlService.setControls).not.toHaveBeenCalled();
            expect(save).toHaveBeenCalledWith({ validateBeforeSave: true });
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceUpdateCompletedEvent.eventName,
                expect.objectContaining({ deviceExternalId: 'device-uuid-123', controlsUpdated: true }),
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

        it('should merge the measurements through the control service without touching the controls', async () => {
            const deviceWithSave = { ...mockDevice, save: jest.fn().mockResolvedValue(undefined) };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });
            mockControlService.mergeValidateControls.mockClear();
            mockControlService.mergeValidateMeasurements.mockResolvedValue({ power: 10, temperature: 25 });

            await service.updateDevice('device-uuid-123', new UpdateDeviceDto({ room: Room.Bedroom, measurements: { temperature: 25 } }));

            expect(mockControlService.mergeValidateMeasurements).toHaveBeenCalledWith(
                { temperature: 25 },
                mockDevice.measurements,
                DeviceConfigValidationPolicy.Reject,
            );
            expect(deviceWithSave.measurements).toEqual({ power: 10, temperature: 25 });
            expect(deviceWithSave.room).toBe(Room.Bedroom);
            expect(deviceWithSave.controls).toEqual(mockDevice.controls);
            expect(mockControlService.mergeValidateControls).not.toHaveBeenCalled();
        });

        it('should reject the update without saving when the measurements are invalid', async () => {
            const save = jest.fn().mockResolvedValue(undefined);
            const deviceWithSave = { ...mockDevice, save };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });
            mockControlService.mergeValidateMeasurements.mockRejectedValue(new Error('invalid measurements'));

            await expect(
                service.updateDevice('device-uuid-123', new UpdateDeviceDto({ measurements: { power: 'a lot' } })),
            ).rejects.toThrow('invalid measurements');
            expect(save).not.toHaveBeenCalled();
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
                brand: DeviceBrand.Philips,
                transportProtocol: TransportProtocol.Zigbee,
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

        it('should validate the controls with the control service of the updated brand', async () => {
            const deviceWithSave = { ...mockDevice, save: jest.fn().mockResolvedValue(undefined) };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });
            mockControlService.mergeValidateControls.mockResolvedValue({ on: true });
            mockControlServiceFactory.getControlService.mockClear();

            const updateDto = new UpdateDeviceDto({
                brand: DeviceBrand.Shelly,
                transportProtocol: TransportProtocol.Http,
                controls: { on: true },
            });
            await service.updateDevice('device-uuid-123', updateDto);

            // The brand/protocol of the update have to be applied before the control service is resolved
            expect(mockControlServiceFactory.getControlService).toHaveBeenCalledWith(
                expect.objectContaining({ brand: DeviceBrand.Shelly, transportProtocol: TransportProtocol.Http }),
            );
            expect(mockControlServiceFactory.getControlService).not.toHaveBeenCalledWith(
                expect.objectContaining({ brand: DeviceBrand.Tuya }),
            );
        });

        it('should not rename zigbee device when friendly name is unchanged', async () => {
            const deviceWithSave = {
                ...mockDevice,
                brand: DeviceBrand.Philips,
                transportProtocol: TransportProtocol.Zigbee,
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
            mockControlService.validateCommand.mockResolvedValue({ action: 'on_press' });

            const command = { action: 'on_press' };
            const result = await service.sendCommand('device-uuid-123', command);

            expect(result).toEqual(mockDevice);
            expect(mockControlService.validateCommand).toHaveBeenCalledWith(command, DeviceConfigValidationPolicy.Reject);
            expect(mockControlService.setControls).toHaveBeenCalledWith({ action: 'on_press' });
        });

        it('should emit DeviceCommandExecutedEvent with command payload', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });
            mockControlService.validateCommand.mockResolvedValue({ action: 'on_press' });

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
            mockControlService.validateCommand.mockResolvedValue({ action: 'on_press' });

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
