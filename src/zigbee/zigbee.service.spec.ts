import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ZigbeeService } from './zigbee.service';
import { MqttService } from 'mqtt/mqtt.service';
import { DevicesService } from 'devices/devices.service';
import { UpdateDeviceDto } from 'devices/dto';
import { DeviceUpdateRequestedEvent } from 'devices/events';
import { DeviceBrand, DeviceType, DeviceUpdateOrigin, Room, Device } from 'devices/interfaces';
import { ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC, ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC, ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC } from './zigbee.constants';
import { ZigbeeBridge } from './store/zigbee-bridge';
import { ZigbeeDevice } from './interfaces';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';

describe('ZigbeeService', () => {
    let service: ZigbeeService;
    let mockMqttService: { publish: jest.Mock };
    let mockDevicesService: {
        getDevice: jest.Mock;
        getDeviceByZigbeeFriendlyName: jest.Mock;
        getDevicesByZigbeeIeeeAddresses: jest.Mock;
        sendCommand: jest.Mock;
    };
    let mockDeviceConfigsMapper: { categorizeAndMapPayloadFromDevice: jest.Mock };
    let mockEventEmitter: { emit: jest.Mock };
    let connectedSpy: jest.SpyInstance;

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

    // The update requests emitted by the service, in emission order.
    const emittedDeviceUpdates = (): Array<DeviceUpdateRequestedEvent> => {
        return mockEventEmitter.emit.mock.calls
            .filter(([eventName]) => eventName === DeviceUpdateRequestedEvent.eventName)
            .map(([, event]) => event as DeviceUpdateRequestedEvent);
    };

    beforeEach(async () => {
        mockMqttService = { publish: jest.fn() };
        mockDevicesService = {
            getDevice: jest.fn(),
            getDeviceByZigbeeFriendlyName: jest.fn(),
            getDevicesByZigbeeIeeeAddresses: jest.fn().mockResolvedValue([]),
            sendCommand: jest.fn(),
        };
        mockDeviceConfigsMapper = {
            categorizeAndMapPayloadFromDevice: jest.fn().mockResolvedValue({ commands: {}, controls: {}, measurements: {} }),
        };
        mockEventEmitter = { emit: jest.fn() };
        // The bridge is treated as connected by default; individual tests override this.
        connectedSpy = jest.spyOn(ZigbeeBridge, 'connected').mockReturnValue(true);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ZigbeeService,
                { provide: MqttService, useValue: mockMqttService },
                { provide: DevicesService, useValue: mockDevicesService },
                { provide: DeviceConfigsMapperService, useValue: mockDeviceConfigsMapper },
                { provide: EventEmitter2, useValue: mockEventEmitter },
            ],
        }).compile();

        service = module.get<ZigbeeService>(ZigbeeService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
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

        it('should not publish when the bridge is not connected', () => {
            connectedSpy.mockReturnValue(false);

            service.setPermitJoin(true, 120);

            expect(mockMqttService.publish).not.toHaveBeenCalled();
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

        it('should not publish when the bridge is not connected', async () => {
            connectedSpy.mockReturnValue(false);

            await service.renameDevice('0x001', 'new_name');

            expect(mockMqttService.publish).not.toHaveBeenCalled();
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

        it('should not publish when the bridge is not connected', async () => {
            connectedSpy.mockReturnValue(false);

            await service.removeZigbeeDevice('0x001');

            expect(mockMqttService.publish).not.toHaveBeenCalled();
        });
    });

    describe('updateDeviceState', () => {
        it('should send a command for fields categorized as commands by the device config', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);
            mockDeviceConfigsMapper.categorizeAndMapPayloadFromDevice.mockResolvedValue({
                commands: { action: 'on' },
                controls: {},
                measurements: {},
            });

            await service.handleDeviceStateUpdate('living_room_bulb', { action: 'on' });

            expect(mockDevicesService.getDeviceByZigbeeFriendlyName).toHaveBeenCalledWith('living_room_bulb');
            expect(mockDeviceConfigsMapper.categorizeAndMapPayloadFromDevice).toHaveBeenCalledWith(mockDevice, { action: 'on' });
            expect(mockDevicesService.sendCommand).toHaveBeenCalledWith(
                'device-uuid-123',
                { action: 'on' },
                {
                    origin: DeviceUpdateOrigin.Device,
                },
            );
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should request an update with fields categorized as measurements by the device config', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);
            mockDeviceConfigsMapper.categorizeAndMapPayloadFromDevice.mockResolvedValue({
                commands: {},
                controls: {},
                measurements: { battery: 95, linkquality: 220 },
            });

            await service.handleDeviceStateUpdate('living_room_bulb', { battery: 95, linkquality: 220 });

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceUpdateRequestedEvent.eventName,
                expect.objectContaining({
                    selector: { externalId: 'device-uuid-123' },
                    update: expect.objectContaining({ measurements: { battery: 95, linkquality: 220 } }),
                }),
            );
            const [event] = emittedDeviceUpdates();
            expect(event).toBeInstanceOf(DeviceUpdateRequestedEvent);
            expect(event.update).toBeInstanceOf(UpdateDeviceDto);
            expect(event.update.controls).toBeUndefined();
            expect(mockDevicesService.sendCommand).not.toHaveBeenCalled();
        });

        it('should partition commands, controls and measurements in the same payload', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);
            mockDeviceConfigsMapper.categorizeAndMapPayloadFromDevice.mockResolvedValue({
                commands: { action: 'on' },
                controls: { on: true },
                measurements: { battery: 90 },
            });

            await service.handleDeviceStateUpdate('living_room_bulb', { action: 'on', state: 'ON', battery: 90, unknown_field: 1 });

            expect(mockDevicesService.sendCommand).toHaveBeenCalledWith(
                'device-uuid-123',
                { action: 'on' },
                {
                    origin: DeviceUpdateOrigin.Device,
                },
            );
            const [event] = emittedDeviceUpdates();
            expect(event.update.measurements).toEqual({ battery: 90 });
            expect(event.update.controls).toEqual({ on: true });
        });

        it('should request a single update carrying both controls and measurements', async () => {
            // Controls and measurements from one Zigbee message must travel in one event, otherwise
            // the device is updated (and its scenarios triggered) twice.
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);
            mockDeviceConfigsMapper.categorizeAndMapPayloadFromDevice.mockResolvedValue({
                commands: {},
                controls: { on: true },
                measurements: { battery: 90 },
            });

            await service.handleDeviceStateUpdate('living_room_bulb', { state: 'ON', battery: 90 });

            expect(emittedDeviceUpdates()).toHaveLength(1);
        });

        it('should skip both sendCommand and the update request when the config maps no fields', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);

            await service.handleDeviceStateUpdate('living_room_bulb', { unknown_field: 1 });

            expect(mockDevicesService.sendCommand).not.toHaveBeenCalled();
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should do nothing when no device matches the friendly name', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(null);

            await service.handleDeviceStateUpdate('unknown', { action: 'on' });

            expect(mockDeviceConfigsMapper.categorizeAndMapPayloadFromDevice).not.toHaveBeenCalled();
            expect(mockDevicesService.sendCommand).not.toHaveBeenCalled();
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should swallow errors thrown while looking up the device', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockRejectedValue(new Error('Database error'));

            await expect(service.handleDeviceStateUpdate('living_room_bulb', { action: 'on' })).resolves.toBeUndefined();
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should swallow errors thrown by sendCommand', async () => {
            mockDevicesService.getDeviceByZigbeeFriendlyName.mockResolvedValue(mockDevice);
            mockDeviceConfigsMapper.categorizeAndMapPayloadFromDevice.mockResolvedValue({
                commands: { action: 'on' },
                controls: { on: true },
                measurements: {},
            });
            mockDevicesService.sendCommand.mockRejectedValue(new Error('Control service failure'));

            await expect(service.handleDeviceStateUpdate('living_room_bulb', { action: 'on' })).resolves.toBeUndefined();
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });
    });

    describe('syncFriendlyNames', () => {
        const makeZigbeeDevice = (overrides: Partial<ZigbeeDevice> = {}): ZigbeeDevice => ({
            ieee_address: '0x001',
            friendly_name: 'living_room_bulb',
            type: 'EndDevice',
            supported: true,
            disabled: false,
            interview_completed: true,
            interview_state: 'SUCCESSFUL',
            definition: { model: 'M1', vendor: 'V', description: 'D' },
            ...overrides,
        });

        it('should look the stored devices up by the ieee addresses the bridge reports', async () => {
            await service.syncFriendlyNames([makeZigbeeDevice(), makeZigbeeDevice({ ieee_address: '0x002', friendly_name: 'other' })]);

            expect(mockDevicesService.getDevicesByZigbeeIeeeAddresses).toHaveBeenCalledWith(['0x001', '0x002']);
        });

        it('should request an update with the bridge name when the stored one differs', async () => {
            // Zigbee2MQTT lost its config and fell back to the ieee address as the friendly name
            mockDevicesService.getDevicesByZigbeeIeeeAddresses.mockResolvedValue([mockDevice]);

            await service.syncFriendlyNames([makeZigbeeDevice({ friendly_name: '0x001' })]);

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceUpdateRequestedEvent.eventName,
                expect.objectContaining({
                    selector: { externalId: 'device-uuid-123' },
                    update: expect.objectContaining({ zigbeeFriendlyName: '0x001' }),
                    propagate: false,
                }),
            );
            const [event] = emittedDeviceUpdates();
            expect(event).toBeInstanceOf(DeviceUpdateRequestedEvent);
            expect(event.update).toBeInstanceOf(UpdateDeviceDto);
        });

        it('should not request an update when the stored name matches the bridge one', async () => {
            mockDevicesService.getDevicesByZigbeeIeeeAddresses.mockResolvedValue([mockDevice]);

            await service.syncFriendlyNames([makeZigbeeDevice()]);

            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should only update the devices whose names drifted', async () => {
            const otherDevice: Partial<Device> = {
                ...mockDevice,
                externalId: 'device-uuid-456',
                zigbeeIeeeAddress: '0x002',
                zigbeeFriendlyName: 'kitchen_remote',
            };
            mockDevicesService.getDevicesByZigbeeIeeeAddresses.mockResolvedValue([mockDevice, otherDevice]);

            await service.syncFriendlyNames([makeZigbeeDevice(), makeZigbeeDevice({ ieee_address: '0x002', friendly_name: '0x002' })]);

            const events = emittedDeviceUpdates();
            expect(events).toHaveLength(1);
            expect(events[0].selector).toEqual({ externalId: 'device-uuid-456' });
            expect(events[0].update.zigbeeFriendlyName).toBe('0x002');
        });

        it('should skip a bridge entry without a friendly name', async () => {
            // A blank name would fail the device validation and can never be a state topic anyway
            mockDevicesService.getDevicesByZigbeeIeeeAddresses.mockResolvedValue([mockDevice]);

            await service.syncFriendlyNames([makeZigbeeDevice({ friendly_name: '' })]);

            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should not touch the stored devices the bridge no longer reports', async () => {
            mockDevicesService.getDevicesByZigbeeIeeeAddresses.mockResolvedValue([mockDevice]);

            await service.syncFriendlyNames([makeZigbeeDevice({ ieee_address: '0x002', friendly_name: 'other' })]);

            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('should do nothing for an empty bridge list', async () => {
            await service.syncFriendlyNames([]);

            expect(mockDevicesService.getDevicesByZigbeeIeeeAddresses).toHaveBeenCalledWith([]);
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });
    });

    describe('handleDeviceExternalRename', () => {
        it('should request an update selecting the device by its old friendly name', async () => {
            await service.handleDeviceExternalRename('old_name', 'new_name');

            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                DeviceUpdateRequestedEvent.eventName,
                expect.objectContaining({
                    selector: { zigbeeFriendlyName: 'old_name' },
                    update: expect.objectContaining({ zigbeeFriendlyName: 'new_name' }),
                }),
            );
            const [event] = emittedDeviceUpdates();
            expect(event).toBeInstanceOf(DeviceUpdateRequestedEvent);
            expect(event.update).toBeInstanceOf(UpdateDeviceDto);
        });

        it('should not look the device up itself', async () => {
            // Resolving the device from the selector is DevicesService's job now.
            await service.handleDeviceExternalRename('old_name', 'new_name');

            expect(mockDevicesService.getDeviceByZigbeeFriendlyName).not.toHaveBeenCalled();
        });

        it('should not request an update when the friendly name is unchanged', async () => {
            await service.handleDeviceExternalRename('living_room_bulb', 'living_room_bulb');

            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
        });
    });
});
