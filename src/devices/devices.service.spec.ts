/* eslint-disable camelcase */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DevicesService } from './devices.service';
import { DEVICE_MODEL_PROVIDER_NAME } from './devices.constants';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { Device, DeviceBrand, DeviceType, PairableDevice, Room } from './interfaces';
import { DeviceControlsUpdatedEvent, DeviceMeasurementsUpdatedEvent } from './events';
import { CreateDeviceDto, UpdateDeviceDto, GetDevicesDto, GetPairableDevicesDto } from './dto';
import { MqttService } from 'mqtt/mqtt.service';
import { ZigbeeDevice } from 'mqtt/interfaces';

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
    let mockMqttService: {
        setZigbeePermitJoin: jest.Mock;
        renameZigbeeDevice: jest.Mock;
        removeZigbeeDevice: jest.Mock;
    };

    const getStaticPairableCache = (): Map<string, PairableDevice> =>
        (DevicesService as unknown as { pairableDevices: Map<string, PairableDevice> }).pairableDevices;

    const setStaticPairableCache = (entries: Array<[string, PairableDevice]>): void => {
        (DevicesService as unknown as { pairableDevices: Map<string, PairableDevice> }).pairableDevices = new Map(entries);
    };

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
        mockMqttService = {
            setZigbeePermitJoin: jest.fn().mockResolvedValue(undefined),
            renameZigbeeDevice: jest.fn().mockResolvedValue(undefined),
            removeZigbeeDevice: jest.fn().mockResolvedValue(undefined),
        };

        setStaticPairableCache([]);

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
                    provide: MqttService,
                    useValue: mockMqttService,
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

        it('should throw BadRequestException when zigbeeIeeeAddress is not currently pairable', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

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
            expect(mockMqttService.renameZigbeeDevice).not.toHaveBeenCalled();
        });

        it('should rename zigbee device after creation when friendly name is set', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
            mockControlService.mergeValidateControls.mockResolvedValue({ on: true });
            setStaticPairableCache([['0xpairable', { zigbeeIeeeAddress: '0xpairable', zigbeeFriendlyName: '0xpairable' }]]);

            const createDto: CreateDeviceDto = {
                name: 'Zigbee Bulb',
                type: DeviceType.LED,
                brand: DeviceBrand.Philips,
                zigbeeIeeeAddress: '0xpairable',
                zigbeeFriendlyName: 'living_room',
                controls: { on: true },
            } as CreateDeviceDto;

            await service.addDevice(createDto);

            expect(mockMqttService.renameZigbeeDevice).toHaveBeenCalledWith('0xpairable', 'living_room');
        });

        it('should not call mqttService.renameZigbeeDevice for non-zigbee devices', async () => {
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

            expect(mockMqttService.renameZigbeeDevice).not.toHaveBeenCalled();
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

        it('should throw BadRequestException when zigbeeIeeeAddress is changed', async () => {
            const deviceWithSave = {
                ...mockDevice,
                zigbeeIeeeAddress: '0xexisting',
                save: jest.fn(),
            };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(deviceWithSave),
            });

            const updateDto = new UpdateDeviceDto({ zigbeeIeeeAddress: '0xdifferent' });

            await expect(service.updateDevice('device-uuid-123', updateDto)).rejects.toThrow(BadRequestException);
            await expect(service.updateDevice('device-uuid-123', updateDto)).rejects.toThrow(
                'Zigbee Ieee address cannot be changed, add a new device instead',
            );
            expect(deviceWithSave.save).not.toHaveBeenCalled();
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
            setStaticPairableCache([['0xpairable', { zigbeeIeeeAddress: '0xpairable', zigbeeFriendlyName: 'old_name' }]]);

            const updateDto = new UpdateDeviceDto({
                zigbeeIeeeAddress: '0xpairable',
                zigbeeFriendlyName: 'new_name',
            });

            await service.updateDevice('device-uuid-123', updateDto);

            expect(mockMqttService.renameZigbeeDevice).toHaveBeenCalledWith('0xpairable', 'new_name');
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
            setStaticPairableCache([['0xpairable', { zigbeeIeeeAddress: '0xpairable', zigbeeFriendlyName: 'same_name' }]]);

            const updateDto = new UpdateDeviceDto({
                zigbeeIeeeAddress: '0xpairable',
                zigbeeFriendlyName: 'same_name',
            });

            await service.updateDevice('device-uuid-123', updateDto);

            expect(mockMqttService.renameZigbeeDevice).not.toHaveBeenCalled();
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

        it('should remove zigbee device via mqtt when device has zigbeeIeeeAddress', async () => {
            const zigbeeDevice = { ...mockDevice, zigbeeIeeeAddress: '0xremoveme' };
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(zigbeeDevice),
            });
            mockDeviceModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });

            await service.removeDevice('device-uuid-123');

            expect(mockMqttService.removeZigbeeDevice).toHaveBeenCalledWith('0xremoveme');
        });

        it('should not call mqttService.removeZigbeeDevice for non-zigbee devices', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });
            mockDeviceModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });

            await service.removeDevice('device-uuid-123');

            expect(mockMqttService.removeZigbeeDevice).not.toHaveBeenCalled();
        });
    });

    describe('toggleDevicePairingMode', () => {
        it('should enable pairing mode with provided timeout', async () => {
            const result = await service.toggleDevicePairingMode(true, 60);

            expect(mockMqttService.setZigbeePermitJoin).toHaveBeenCalledWith(true, 60);
            expect(result).toEqual({ enabled: true, timeout: 60 });
        });

        it('should disable pairing mode and zero out the returned timeout', async () => {
            const result = await service.toggleDevicePairingMode(false, 60);

            expect(mockMqttService.setZigbeePermitJoin).toHaveBeenCalledWith(false, 60);
            expect(result).toEqual({ enabled: false, timeout: 0 });
        });
    });

    describe('savePairableDevices', () => {
        const makeZigbeeDevice = (overrides: Partial<ZigbeeDevice> = {}): ZigbeeDevice => ({
            ieee_address: '0x111',
            friendly_name: 'bulb_1',
            type: 'EndDevice',
            supported: true,
            disabled: false,
            interview_completed: true,
            interview_state: 'SUCCESSFUL',
            definition: { model: 'M1', vendor: 'V', description: 'D' },
            ...overrides,
        });

        it('should store eligible devices keyed by ieee address', async () => {
            await service.savePairableDevices([
                makeZigbeeDevice({ ieee_address: '0x001', friendly_name: 'bulb_a' }),
                makeZigbeeDevice({ ieee_address: '0x002', friendly_name: 'bulb_b' }),
            ]);

            const cache = getStaticPairableCache();
            expect(cache.size).toBe(2);
            expect(cache.get('0x001')).toEqual({ zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' });
            expect(cache.get('0x002')).toEqual({ zigbeeIeeeAddress: '0x002', zigbeeFriendlyName: 'bulb_b' });
        });

        it('should filter out the Coordinator', async () => {
            await service.savePairableDevices([
                makeZigbeeDevice({ ieee_address: '0x001', type: 'Coordinator' }),
                makeZigbeeDevice({ ieee_address: '0x002' }),
            ]);

            const cache = getStaticPairableCache();
            expect(cache.has('0x001')).toBe(false);
            expect(cache.has('0x002')).toBe(true);
        });

        it('should filter out unsupported devices', async () => {
            await service.savePairableDevices([makeZigbeeDevice({ ieee_address: '0x001', supported: false })]);

            expect(getStaticPairableCache().size).toBe(0);
        });

        it('should filter out disabled devices', async () => {
            await service.savePairableDevices([makeZigbeeDevice({ ieee_address: '0x001', disabled: true })]);

            expect(getStaticPairableCache().size).toBe(0);
        });

        it('should filter out devices whose interview has not completed', async () => {
            await service.savePairableDevices([makeZigbeeDevice({ ieee_address: '0x001', interview_completed: false })]);

            expect(getStaticPairableCache().size).toBe(0);
        });

        it('should filter out devices whose interview state is not SUCCESSFUL', async () => {
            await service.savePairableDevices([
                makeZigbeeDevice({ ieee_address: '0x001', interview_state: 'FAILED' }),
                makeZigbeeDevice({ ieee_address: '0x002', interview_state: 'IN_PROGRESS' }),
                makeZigbeeDevice({ ieee_address: '0x003', interview_state: 'PENDING' }),
            ]);

            expect(getStaticPairableCache().size).toBe(0);
        });

        it('should replace the previously cached devices', async () => {
            await service.savePairableDevices([makeZigbeeDevice({ ieee_address: '0xold' })]);
            await service.savePairableDevices([makeZigbeeDevice({ ieee_address: '0xnew' })]);

            const cache = getStaticPairableCache();
            expect(cache.has('0xold')).toBe(false);
            expect(cache.has('0xnew')).toBe(true);
        });
    });

    describe('getPairableDevices', () => {
        it('should return an empty page when no devices are cached', async () => {
            const result = await service.getPairableDevices();

            expect(result.devices).toEqual([]);
            expect(result.totalPages).toBe(0);
            expect(mockDeviceModel.find).not.toHaveBeenCalled();
        });

        it('should exclude devices that are already registered', async () => {
            setStaticPairableCache([
                ['0x001', { zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' }],
                ['0x002', { zigbeeIeeeAddress: '0x002', zigbeeFriendlyName: 'bulb_b' }],
                ['0x003', { zigbeeIeeeAddress: '0x003', zigbeeFriendlyName: 'bulb_c' }],
            ]);
            mockDeviceModel.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue([{ zigbeeIeeeAddress: '0x002' }]),
            });

            const result = await service.getPairableDevices();

            expect(mockDeviceModel.find).toHaveBeenCalledWith(
                { zigbeeIeeeAddress: { $in: ['0x001', '0x002', '0x003'] } },
                { zigbeeIeeeAddress: 1 },
            );
            expect(result.devices.map(d => d.zigbeeIeeeAddress)).toEqual(['0x001', '0x003']);
            expect(result.totalPages).toBe(1);
        });

        it('should paginate the pairable devices', async () => {
            const entries: Array<[string, PairableDevice]> = Array.from({ length: 25 }, (_, i) => {
                const ieee = `0x${i.toString().padStart(3, '0')}`;
                return [ieee, { zigbeeIeeeAddress: ieee, zigbeeFriendlyName: `bulb_${i}` }];
            });
            setStaticPairableCache(entries);
            mockDeviceModel.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
            });

            const options = new GetPairableDevicesDto();
            options.page = 2;
            options.pageSize = 10;

            const result = await service.getPairableDevices(options);

            expect(result.devices).toHaveLength(10);
            expect(result.devices[0].zigbeeIeeeAddress).toBe('0x010');
            expect(result.devices[9].zigbeeIeeeAddress).toBe('0x019');
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(10);
            expect(result.totalPages).toBe(3);
        });
    });
});
