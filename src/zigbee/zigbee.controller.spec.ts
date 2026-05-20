import { Test, TestingModule } from '@nestjs/testing';
import { MqttContext } from '@nestjs/microservices';
import { ZigbeeController } from './zigbee.controller';
import { ZigbeeService } from './zigbee.service';
import { MqttService } from 'mqtt/mqtt.service';
import { ZIGBEE_DEVICE_STATE_TOPIC } from './zigbee.constants';
import { ZigbeeBridgeHealth, ZigbeeDevice } from './interfaces';
import { ZigbeePairableDevices } from './store';
import { ZigbeeBridge } from './store/zigbee-bridge';

describe('ZigbeeController', () => {
    let controller: ZigbeeController;
    let mockZigbeeService: {
        handleDeviceStateUpdate: jest.Mock;
        handleDeviceExternalRename: jest.Mock;
    };
    let mockMqttService: { extractTopicWildcards: jest.Mock };
    let saveSpy: jest.SpyInstance;
    let bridgeSaveSpy: jest.SpyInstance;

    const makeContext = (topic: string): MqttContext =>
        ({
            getTopic: jest.fn().mockReturnValue(topic),
            getPacket: jest.fn().mockReturnValue({ payload: {} }),
        }) as unknown as MqttContext;

    const sampleZigbeeDevice: ZigbeeDevice = {
        ieee_address: '0x001',
        friendly_name: 'living_room_bulb',
        type: 'EndDevice',
        supported: true,
        disabled: false,
        interview_completed: true,
        interview_state: 'SUCCESSFUL',
        definition: { model: 'M1', vendor: 'V', description: 'D' },
    };

    beforeEach(async () => {
        mockZigbeeService = {
            handleDeviceStateUpdate: jest.fn().mockResolvedValue(undefined),
            handleDeviceExternalRename: jest.fn().mockResolvedValue(undefined),
        };
        mockMqttService = { extractTopicWildcards: jest.fn() };
        saveSpy = jest.spyOn(ZigbeePairableDevices, 'save').mockImplementation(() => undefined);
        bridgeSaveSpy = jest.spyOn(ZigbeeBridge, 'save').mockImplementation(() => undefined);

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ZigbeeController],
            providers: [
                { provide: ZigbeeService, useValue: mockZigbeeService },
                { provide: MqttService, useValue: mockMqttService },
            ],
        }).compile();

        controller = module.get<ZigbeeController>(ZigbeeController);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('onBridgeHealthCheck', () => {
        it('should forward the health report to ZigbeeBridge.save', () => {
            const health = { mqtt: { connected: true } } as ZigbeeBridgeHealth;

            controller.onBridgeHealthCheck(makeContext('zigbee2mqtt/bridge/health'), health);

            expect(bridgeSaveSpy).toHaveBeenCalledWith(health);
        });
    });

    describe('onConnectedDevicesListChange', () => {
        it('should forward the device list to ZigbeePairableDevices.save', () => {
            const devices = [sampleZigbeeDevice];

            controller.onConnectedDevicesListChange(makeContext('zigbee2mqtt/bridge/devices'), devices);

            expect(saveSpy).toHaveBeenCalledWith(devices);
        });

        it('should default to an empty array when no payload is provided', () => {
            controller.onConnectedDevicesListChange(makeContext('zigbee2mqtt/bridge/devices'), null as unknown as Array<ZigbeeDevice>);

            expect(saveSpy).toHaveBeenCalledWith([]);
        });
    });

    describe('onDeviceStateChange', () => {
        it('should update the device state for a real device', async () => {
            mockMqttService.extractTopicWildcards.mockReturnValue(['living_room_bulb']);
            const state = { action: 'on', battery: 90 };

            await controller.onDeviceStateChange(makeContext('zigbee2mqtt/living_room_bulb'), state);

            expect(mockMqttService.extractTopicWildcards).toHaveBeenCalledWith(ZIGBEE_DEVICE_STATE_TOPIC, 'zigbee2mqtt/living_room_bulb');
            expect(mockZigbeeService.handleDeviceStateUpdate).toHaveBeenCalledWith('living_room_bulb', state);
        });

        it('should ignore the bridge status topic', async () => {
            mockMqttService.extractTopicWildcards.mockReturnValue(['bridge']);

            await controller.onDeviceStateChange(makeContext('zigbee2mqtt/bridge'), { state: 'online' });

            expect(mockZigbeeService.handleDeviceStateUpdate).not.toHaveBeenCalled();
        });

        it('should ignore nested bridge topics', async () => {
            mockMqttService.extractTopicWildcards.mockReturnValue(['bridge/devices']);

            await controller.onDeviceStateChange(makeContext('zigbee2mqtt/bridge/devices'), [sampleZigbeeDevice] as unknown as Record<
                string,
                unknown
            >);

            expect(mockZigbeeService.handleDeviceStateUpdate).not.toHaveBeenCalled();
        });
    });

    describe('onDeviceFriendlyNameChange', () => {
        it('should handle a rename response carrying both from and to', async () => {
            const response = { from: 'MainLightRemote', to: 'MainLightRemoteTest', homeassistant_rename: false };

            await controller.onDeviceFriendlyNameChange(makeContext('zigbee2mqtt/bridge/response/device/rename'), response);

            expect(mockZigbeeService.handleDeviceExternalRename).toHaveBeenCalledWith('MainLightRemote', 'MainLightRemoteTest');
        });

        it('should not handle the rename when "to" is missing', async () => {
            const response = { from: 'MainLightRemote' };

            await controller.onDeviceFriendlyNameChange(makeContext('zigbee2mqtt/bridge/response/device/rename'), response);

            expect(mockZigbeeService.handleDeviceExternalRename).not.toHaveBeenCalled();
        });

        it('should not handle the rename when "from" is missing', async () => {
            const response = { to: 'MainLightRemoteTest' };

            await controller.onDeviceFriendlyNameChange(makeContext('zigbee2mqtt/bridge/response/device/rename'), response);

            expect(mockZigbeeService.handleDeviceExternalRename).not.toHaveBeenCalled();
        });
    });
});
