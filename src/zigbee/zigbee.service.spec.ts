import { Test, TestingModule } from '@nestjs/testing';
import { ZigbeeService } from './zigbee.service';
import { MqttService } from 'mqtt/mqtt.service';
import { DevicesService } from 'devices/devices.service';
import { UpdateDeviceDto } from 'devices/dto';
import { DeviceBrand, DeviceType, Room, Device } from 'devices/interfaces';
import { ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC, ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC, ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC } from './zigbee.constants';

describe('ZigbeeService', () => {
    let service: ZigbeeService;
    let mockMqttService: { publish: jest.Mock };
    let mockDevicesService: { getDevice: jest.Mock; getDeviceByZigbeeFriendlyName: jest.Mock; updateDevice: jest.Mock };

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
        mockDevicesService = { getDevice: jest.fn(), getDeviceByZigbeeFriendlyName: jest.fn(), updateDevice: jest.fn() };

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
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);

            await service.updateDeviceState('living_room_bulb', { action: 'on' });

            expect(mockDevicesService.getDeviceByZigbeeFriendlyName).toHaveBeenCalledWith('living_room_bulb');
            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith(
                'device-uuid-123',
                expect.objectContaining({ controls: { action: 'on' } }),
            );
            const updateArg = mockDevicesService.updateDevice.mock.calls[0][1];
            expect(updateArg).toBeInstanceOf(UpdateDeviceDto);
        });

        it('should update the device with supported measurements', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);

            await service.updateDeviceState('living_room_bulb', { battery: 95, linkquality: 220 });

            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith(
                'device-uuid-123',
                expect.objectContaining({ measurements: { battery: 95, linkquality: 220 } }),
            );
        });

        it('should partition controls and measurements in the same payload', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);

            await service.updateDeviceState('living_room_bulb', { action: 'on', battery: 90, unknown_field: 'ignored' });

            const dto = mockDevicesService.updateDevice.mock.calls[0][1];
            expect(dto.controls).toEqual({ action: 'on' });
            expect(dto.measurements).toEqual({ battery: 90 });
        });

        it('should skip the update when no supported fields are present', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);

            await service.updateDeviceState('living_room_bulb', { unknown_field: 1 });

            expect(mockDevicesService.updateDevice).not.toHaveBeenCalled();
        });

        it('should do nothing when no device matches the friendly name', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(null);

            await service.updateDeviceState('unknown', { action: 'on' });

            expect(mockDevicesService.updateDevice).not.toHaveBeenCalled();
        });

        it('should swallow errors thrown while looking up or updating the device', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockRejectedValue(new Error('Database error'));

            await expect(service.updateDeviceState('living_room_bulb', { action: 'on' })).resolves.toBeUndefined();
        });
    });

    describe('handleDeviceExternalRename', () => {
        it('should update the device with the new friendly name', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);

            await service.handleDeviceExternalRename('old_name', 'new_name');

            expect(mockDevicesService.getDeviceByZigbeeFriendlyName).toHaveBeenCalledWith('old_name');
            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith(
                'device-uuid-123',
                expect.objectContaining({ zigbeeFriendlyName: 'new_name' }),
            );
            const updateArg = mockDevicesService.updateDevice.mock.calls[0][1];
            expect(updateArg).toBeInstanceOf(UpdateDeviceDto);
        });

        it('should do nothing when no device matches the old friendly name', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(null);

            await service.handleDeviceExternalRename('old_name', 'new_name');

            expect(mockDevicesService.updateDevice).not.toHaveBeenCalled();
        });

        it('should not update the device when the friendly name is unchanged', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);

            await service.handleDeviceExternalRename('living_room_bulb', 'living_room_bulb');

            expect(mockDevicesService.updateDevice).not.toHaveBeenCalled();
        });

        it('should fall back to the ieee address when the new friendly name is empty', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);

            await service.handleDeviceExternalRename('old_name', null as unknown as string);

            expect(mockDevicesService.updateDevice).toHaveBeenCalledWith(
                'device-uuid-123',
                expect.objectContaining({ zigbeeFriendlyName: mockDevice.zigbeeIeeeAddress }),
            );
        });
    });
});
