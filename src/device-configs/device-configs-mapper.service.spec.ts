import { DeviceConfigsMapperService } from './device-configs-mapper.service';
import { DeviceConfigsService } from './device-configs.service';
import { DeviceConfig, DeviceConfigItemType, DeviceConfigKey } from './interfaces';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';

describe('DeviceConfigsMapperService', () => {
    let service: DeviceConfigsMapperService;
    let mockDeviceConfigsService: { getConfig: jest.Mock };

    const configKey: DeviceConfigKey = {
        brand: DeviceBrand.Philips,
        type: DeviceType.Remote,
        transportProtocol: TransportProtocol.Zigbee,
    };

    const mockConfig: Partial<DeviceConfig> = {
        ...configKey,
        commands: [
            {
                label: 'Action',
                name: 'action',
                type: DeviceConfigItemType.String,
                values: [
                    { label: 'On', name: 'on', path: 'on_press' },
                    { label: 'Off', name: 'off', path: 'off_press' },
                ],
            },
        ],
        controls: [
            {
                label: 'Power',
                name: 'on',
                type: DeviceConfigItemType.Boolean,
                path: 'state',
                values: [
                    { label: 'On', name: 'true', path: 'ON' },
                    { label: 'Off', name: 'false', path: 'OFF' },
                ],
            },
        ],
        measurements: [
            { label: 'Battery', name: 'battery', type: DeviceConfigItemType.Number },
            { label: 'Link quality', name: 'linkQuality', type: DeviceConfigItemType.Number, path: 'linkquality' },
        ],
    };

    beforeEach(() => {
        mockDeviceConfigsService = { getConfig: jest.fn().mockResolvedValue(mockConfig) };
        service = new DeviceConfigsMapperService(mockDeviceConfigsService as unknown as DeviceConfigsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('mapPayloadToDevice', () => {
        it('should map internal command/control names and values to the device-side paths', async () => {
            const result = await service.mapPayloadToDevice(configKey, { on: true, action: 'on' });

            expect(mockDeviceConfigsService.getConfig).toHaveBeenCalledWith(configKey);
            expect(result).toEqual({ state: 'ON', action: 'on_press' });
        });

        it('should keep names and values not present in the config as-is', async () => {
            const result = await service.mapPayloadToDevice(configKey, { brightness: 100 });

            expect(result).toEqual({ brightness: 100 });
        });

        it('should return the payload untouched when there is no config for the device', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue(null);

            const result = await service.mapPayloadToDevice(configKey, { on: true });

            expect(result).toEqual({ on: true });
        });
    });

    describe('mapPayloadFromDevice', () => {
        it('should map device-side names and values back to the internal ones', async () => {
            const result = await service.mapPayloadFromDevice(configKey, 'controls', { state: 'ON' });

            expect(result).toEqual({ on: true });
        });

        it('should map device-side measurement names without value mappings', async () => {
            const result = await service.mapPayloadFromDevice(configKey, 'measurements', { linkquality: 220, battery: 95 });

            expect(result).toEqual({ linkQuality: 220, battery: 95 });
        });

        it('should keep unknown fields as-is', async () => {
            const result = await service.mapPayloadFromDevice(configKey, 'controls', { unknown_field: 1 });

            expect(result).toEqual({ unknown_field: 1 });
        });

        it('should return the payload untouched when the config section is empty', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue({ ...mockConfig, controls: [] });

            const result = await service.mapPayloadFromDevice(configKey, 'controls', { state: 'ON' });

            expect(result).toEqual({ state: 'ON' });
        });
    });

    describe('splitPayloadFromDevice', () => {
        it('should categorize the payload fields into commands/controls/measurements', async () => {
            const result = await service.splitPayloadFromDevice(configKey, {
                action: 'on_press',
                state: 'OFF',
                battery: 95,
                linkquality: 220,
            });

            expect(result).toEqual({
                commands: { action: 'on' },
                controls: { on: false },
                measurements: { battery: 95, linkQuality: 220 },
            });
        });

        it('should drop fields not present in the config', async () => {
            const result = await service.splitPayloadFromDevice(configKey, { battery: 95, unknown_field: 1 });

            expect(result).toEqual({ commands: {}, controls: {}, measurements: { battery: 95 } });
        });

        it('should return empty sections when there is no config for the device', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue(null);

            const result = await service.splitPayloadFromDevice(configKey, { battery: 95 });

            expect(result).toEqual({ commands: {}, controls: {}, measurements: {} });
        });
    });
});
