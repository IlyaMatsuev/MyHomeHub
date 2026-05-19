import { Test, TestingModule } from '@nestjs/testing';
import { ZigbeeService } from './zigbee.service';
import { MqttService } from 'mqtt/mqtt.service';
import { DevicesService } from 'devices/devices.service';
import { UpdateDeviceDto } from 'devices/dto';
import { DeviceBrand, DeviceType, Room, Device } from 'devices/interfaces';
import { PairableDevice, ZigbeeDevice } from './interfaces';
import { ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC, ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC, ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC } from './zigbee.constants';

describe('ZigbeeService', () => {
    let service: ZigbeeService;
    let mockMqttService: { publish: jest.Mock };
    let mockDevicesService: { getDevice: jest.Mock; updateDevice: jest.Mock };

    const getStaticPairableCache = (): Map<string, PairableDevice> =>
        (ZigbeeService as unknown as { pairableDevices: Map<string, PairableDevice> }).pairableDevices;

    const setStaticPairableCache = (entries: Array<[string, PairableDevice]>): void => {
        (ZigbeeService as unknown as { pairableDevices: Map<string, PairableDevice> }).pairableDevices = new Map(entries);
    };

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

    const mockDevice: Partial<Device> = {
        _id: 'mongo-id-123',
        externalId: 'device-uuid-123',
        name: 'Living Room Bulb',
        type: DeviceType.LED,
        brand: DeviceBrand.Philips,
        room: Room.LivingRoom,
        zigbeeIeeeAddress: '0x001',
        zigbeeFriendlyName: 'living_room_bulb',
        controls: { action: 'off' },
        measurements: {},
    };

    beforeEach(async () => {
        mockMqttService = { publish: jest.fn() };
        mockDevicesService = { getDevice: jest.fn(), updateDevice: jest.fn() };
        setStaticPairableCache([]);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ZigbeeService,
                { provide: MqttService, useValue: mockMqttService },
                { provide: DevicesService, useValue: mockDevicesService },
            ],
        }).compile();

        service = module.get<ZigbeeService>(ZigbeeService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('savePairableDevices', () => {
        it('should store eligible devices keyed by ieee address', () => {
            service.savePairableDevices([
                makeZigbeeDevice({ ieee_address: '0x001', friendly_name: 'bulb_a' }),
                makeZigbeeDevice({ ieee_address: '0x002', friendly_name: 'bulb_b' }),
            ]);

            const cache = getStaticPairableCache();
            expect(cache.size).toBe(2);
            expect(cache.get('0x001')).toEqual({ zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' });
            expect(cache.get('0x002')).toEqual({ zigbeeIeeeAddress: '0x002', zigbeeFriendlyName: 'bulb_b' });
        });

        it('should filter out the Coordinator', () => {
            service.savePairableDevices([
                makeZigbeeDevice({ ieee_address: '0x001', type: 'Coordinator' }),
                makeZigbeeDevice({ ieee_address: '0x002' }),
            ]);

            const cache = getStaticPairableCache();
            expect(cache.has('0x001')).toBe(false);
            expect(cache.has('0x002')).toBe(true);
        });

        it('should filter out unsupported devices', () => {
            service.savePairableDevices([makeZigbeeDevice({ ieee_address: '0x001', supported: false })]);

            expect(getStaticPairableCache().size).toBe(0);
        });

        it('should filter out disabled devices', () => {
            service.savePairableDevices([makeZigbeeDevice({ ieee_address: '0x001', disabled: true })]);

            expect(getStaticPairableCache().size).toBe(0);
        });

        it('should filter out devices whose interview has not completed', () => {
            service.savePairableDevices([makeZigbeeDevice({ ieee_address: '0x001', interview_completed: false })]);

            expect(getStaticPairableCache().size).toBe(0);
        });

        it('should filter out devices whose interview state is not SUCCESSFUL', () => {
            service.savePairableDevices([
                makeZigbeeDevice({ ieee_address: '0x001', interview_state: 'FAILED' }),
                makeZigbeeDevice({ ieee_address: '0x002', interview_state: 'IN_PROGRESS' }),
                makeZigbeeDevice({ ieee_address: '0x003', interview_state: 'PENDING' }),
            ]);

            expect(getStaticPairableCache().size).toBe(0);
        });

        it('should replace the previously cached devices', () => {
            service.savePairableDevices([makeZigbeeDevice({ ieee_address: '0xold' })]);
            service.savePairableDevices([makeZigbeeDevice({ ieee_address: '0xnew' })]);

            const cache = getStaticPairableCache();
            expect(cache.has('0xold')).toBe(false);
            expect(cache.has('0xnew')).toBe(true);
        });
    });

    describe('hasPairableDevice', () => {
        it('should return true when the device is cached', () => {
            setStaticPairableCache([['0x001', { zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' }]]);

            expect(service.hasPairableDevice('0x001')).toBe(true);
        });

        it('should return false when the device is not cached', () => {
            expect(service.hasPairableDevice('0xmissing')).toBe(false);
        });
    });

    describe('getPairableDevice', () => {
        it('should return the cached device when present', () => {
            const pairable = { zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' };
            setStaticPairableCache([['0x001', pairable]]);

            expect(service.getPairableDevice('0x001')).toEqual(pairable);
        });

        it('should return null when no device matches', () => {
            expect(service.getPairableDevice('0xmissing')).toBeNull();
        });
    });

    describe('getPairableDevices', () => {
        it('should return all cached devices as an array', () => {
            const a = { zigbeeIeeeAddress: '0x001', zigbeeFriendlyName: 'bulb_a' };
            const b = { zigbeeIeeeAddress: '0x002', zigbeeFriendlyName: 'bulb_b' };
            setStaticPairableCache([
                ['0x001', a],
                ['0x002', b],
            ]);

            expect(service.getPairableDevices()).toEqual([a, b]);
        });

        it('should return an empty array when nothing is cached', () => {
            expect(service.getPairableDevices()).toEqual([]);
        });
    });

    describe('setPermitJoin', () => {
        it('should publish a permit-join payload including the seconds field when provided', () => {
            service.setPermitJoin(true, 120);

            expect(mockMqttService.publish).toHaveBeenCalledWith(ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC, { value: true, time: 120 });
        });

        it('should omit the seconds field when undefined is passed', () => {
            service.setPermitJoin(false, undefined as unknown as number);

            expect(mockMqttService.publish).toHaveBeenCalledWith(ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC, { value: false });
        });
    });

    describe('renameDevice', () => {
        it('should publish a rename request', async () => {
            await service.renameDevice('0x001', 'new_name');

            expect(mockMqttService.publish).toHaveBeenCalledWith(ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC, {
                from: '0x001',
                to: 'new_name',
            });
        });
    });

    describe('removeZigbeeDevice', () => {
        it('should publish a non-forced remove request by default', async () => {
            await service.removeZigbeeDevice('0x001');

            expect(mockMqttService.publish).toHaveBeenCalledWith(ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC, {
                id: '0x001',
                force: false,
            });
        });

        it('should publish a forced remove request when requested', async () => {
            await service.removeZigbeeDevice('0x001', true);

            expect(mockMqttService.publish).toHaveBeenCalledWith(ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC, {
                id: '0x001',
                force: true,
            });
        });
    });

    describe('updateDeviceState', () => {
        it('should update the device with supported controls', async () => {
            mockDevicesService.getDevice.mockResolvedValue(mockDevice);

            await service.updateDeviceState('living_room_bulb', { action: 'on' });

            expect(mockDevicesService.getDevice).toHaveBeenCalledWith({ zigbeeFriendlyName: 'living_room_bulb' }, { strict: false });
            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith(
                'device-uuid-123',
                expect.objectContaining({ controls: { action: 'on' } }),
            );
            const updateArg = mockDevicesService.updateDevice.mock.calls[0][1];
            expect(updateArg).toBeInstanceOf(UpdateDeviceDto);
        });

        it('should update the device with supported measurements', async () => {
            mockDevicesService.getDevice.mockResolvedValue(mockDevice);

            await service.updateDeviceState('living_room_bulb', { battery: 95, linkquality: 220 });

            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith(
                'device-uuid-123',
                expect.objectContaining({ measurements: { battery: 95, linkquality: 220 } }),
            );
        });

        it('should partition controls and measurements in the same payload', async () => {
            mockDevicesService.getDevice.mockResolvedValue(mockDevice);

            await service.updateDeviceState('living_room_bulb', { action: 'on', battery: 90, unknown_field: 'ignored' });

            const dto = mockDevicesService.updateDevice.mock.calls[0][1];
            expect(dto.controls).toEqual({ action: 'on' });
            expect(dto.measurements).toEqual({ battery: 90 });
        });

        it('should skip the update when no supported fields are present', async () => {
            mockDevicesService.getDevice.mockResolvedValue(mockDevice);

            await service.updateDeviceState('living_room_bulb', { unknown_field: 1 });

            expect(mockDevicesService.updateDevice).not.toHaveBeenCalled();
        });

        it('should do nothing when no device matches the friendly name', async () => {
            mockDevicesService.getDevice.mockResolvedValue(null);

            await service.updateDeviceState('unknown', { action: 'on' });

            expect(mockDevicesService.updateDevice).not.toHaveBeenCalled();
        });

        it('should swallow errors thrown while looking up or updating the device', async () => {
            mockDevicesService.getDevice.mockRejectedValue(new Error('Database error'));

            await expect(service.updateDeviceState('living_room_bulb', { action: 'on' })).resolves.toBeUndefined();
        });
    });
});
