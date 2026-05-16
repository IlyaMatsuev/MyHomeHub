import { ConfigService } from '@nestjs/config';
import { MqttService } from 'mqtt/mqtt.service';
import { Device, DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import { PhilipsControlService } from './philips-control.service';

describe('PhilipsControlService', () => {
    let service: PhilipsControlService;
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

        service = new PhilipsControlService(mockDevice as Device, mockConfigService, mockMqttService as unknown as MqttService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('setControls', () => {
        it('should publish ON state to Z2M', async () => {
            await service.setControls({ on: true });

            expect(mockMqttService.publishZigbeeCommand).toHaveBeenCalledWith('living_room_bulb', { state: 'ON' });
        });

        it('should publish OFF state to Z2M', async () => {
            await service.setControls({ on: false });

            expect(mockMqttService.publishZigbeeCommand).toHaveBeenCalledWith('living_room_bulb', { state: 'OFF' });
        });

        it('should scale brightness from 0-100 to 0-254', async () => {
            await service.setControls({ brightness: 50 });

            expect(mockMqttService.publishZigbeeCommand).toHaveBeenCalledWith('living_room_bulb', { brightness: 127 });
        });

        it('should map color hex to Z2M format', async () => {
            await service.setControls({ color: '#FF0000' });

            expect(mockMqttService.publishZigbeeCommand).toHaveBeenCalledWith('living_room_bulb', {
                color: { hex: '#FF0000' },
            });
        });

        it('should pass color temperature as-is', async () => {
            await service.setControls({ colorTemp: 250 });

            // eslint-disable-next-line camelcase
            expect(mockMqttService.publishZigbeeCommand).toHaveBeenCalledWith('living_room_bulb', { color_temp: 250 });
        });

        it('should handle multiple controls at once', async () => {
            await service.setControls({ on: true, brightness: 100, color: '#00FF00' });

            expect(mockMqttService.publishZigbeeCommand).toHaveBeenCalledWith('living_room_bulb', {
                state: 'ON',
                brightness: 254,
                color: { hex: '#00FF00' },
            });
        });
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
