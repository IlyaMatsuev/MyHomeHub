import { ConfigService } from '@nestjs/config';
import { MqttService } from 'mqtt/mqtt.service';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { PhilipsControlService } from './philips-control.service';

describe('PhilipsControlService', () => {
    let mockConfigService: jest.Mocked<ConfigService>;
    let mockMqttService: {
        publishZigbeeCommand: jest.Mock;
    };

    const mockDevice: Partial<Device> = {
        externalId: 'device-uuid-123',
        name: 'Philips Bulb',
        type: DeviceType.LED,
        brand: DeviceBrand.Philips,
        zigbeeFriendlyName: 'living_room_bulb',
        zigbeeIeeeAddress: '0x00158d0001234567',
        room: Room.LivingRoom,
        controls: { on: false },
    };

    beforeEach(() => {
        mockConfigService = {} as jest.Mocked<ConfigService>;
        mockMqttService = {
            publishZigbeeCommand: jest.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('setControls with missing friendlyName', () => {
        it('should throw error when device has no friendly name', async () => {
            const deviceWithoutFriendlyName = {
                ...mockDevice,
                zigbeeFriendlyName: undefined,
            };
            const serviceWithoutFriendlyName = new PhilipsControlService(
                deviceWithoutFriendlyName as Device,
                mockConfigService,
                mockMqttService as unknown as MqttService,
            );

            await expect(serviceWithoutFriendlyName.setControls({ on: true })).rejects.toThrow('does not have a Zigbee friendly name');
            expect(mockMqttService.publishZigbeeCommand).not.toHaveBeenCalled();
        });
    });
});
