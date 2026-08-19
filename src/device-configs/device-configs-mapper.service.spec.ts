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
                type: DeviceConfigItemType.Enum,
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

    const enumConfig: Partial<DeviceConfig> = {
        ...configKey,
        controls: [
            {
                label: 'Mode',
                name: 'mode',
                type: DeviceConfigItemType.Enum,
                path: 'operation_mode',
                values: [
                    { label: 'Auto', name: 'auto', path: 'AUTO_MODE' },
                    { label: 'Manual', name: 'manual', path: 'MANUAL_MODE' },
                ],
            },
        ],
    };

    const valuelessBooleanConfig: Partial<DeviceConfig> = {
        ...configKey,
        controls: [{ label: 'Power', name: 'on', type: DeviceConfigItemType.Boolean, path: 'state' }],
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

        it('should map enum values to the device-side paths', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue(enumConfig);

            const result = await service.mapPayloadToDevice(configKey, { mode: 'auto' });

            expect(result).toEqual({ operation_mode: 'AUTO_MODE' });
        });

        it('should send the value as-is when the enum value is not declared in the config', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue(enumConfig);

            const result = await service.mapPayloadToDevice(configKey, { mode: 'eco' });

            expect(result).toEqual({ operation_mode: 'eco' });
        });

        it('should not translate values of items that are neither boolean nor enum', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue({
                ...configKey,
                controls: [
                    {
                        label: 'Mode',
                        name: 'mode',
                        type: DeviceConfigItemType.String,
                        values: [{ label: 'Auto', name: 'auto', path: 'AUTO_MODE' }],
                    },
                ],
            });

            const result = await service.mapPayloadToDevice(configKey, { mode: 'auto' });

            expect(result).toEqual({ mode: 'auto' });
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

        it('should cast numeric measurements arriving as strings', async () => {
            const result = await service.mapPayloadFromDevice(configKey, 'measurements', { battery: '95', linkquality: '220' });

            expect(result).toEqual({ battery: 95, linkQuality: 220 });
        });

        it('should keep a numeric measurement as-is when it is not a number', async () => {
            const result = await service.mapPayloadFromDevice(configKey, 'measurements', { battery: 'unknown' });

            expect(result).toEqual({ battery: 'unknown' });
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

        it('should map device-side enum values back to the internal ones', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue(enumConfig);

            const result = await service.mapPayloadFromDevice(configKey, 'controls', { operation_mode: 'MANUAL_MODE' });

            expect(result).toEqual({ mode: 'manual' });
        });

        it('should parse boolean value names regardless of their casing', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue({
                ...configKey,
                controls: [
                    {
                        label: 'Power',
                        name: 'on',
                        type: DeviceConfigItemType.Boolean,
                        path: 'state',
                        values: [{ label: 'On', name: 'TRUE', path: 'ON' }],
                    },
                ],
            });

            const result = await service.mapPayloadFromDevice(configKey, 'controls', { state: 'ON' });

            expect(result).toEqual({ on: true });
        });

        it('should fall back to matching the enum value by name when it declares no path', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue({
                ...configKey,
                controls: [
                    {
                        label: 'Mode',
                        name: 'mode',
                        type: DeviceConfigItemType.Enum,
                        path: 'operation_mode',
                        values: [{ label: 'Auto', name: 'auto' }],
                    },
                ],
            });

            const result = await service.mapPayloadFromDevice(configKey, 'controls', { operation_mode: 'auto' });

            expect(result).toEqual({ mode: 'auto' });
        });

        it('should keep a boolean field as-is when the config item declares no values', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue(valuelessBooleanConfig);

            const result = await service.mapPayloadFromDevice(configKey, 'controls', { state: 'ON' });

            expect(result).toEqual({ state: 'ON' });
        });

        it('should map the name but not the value of items that are neither boolean nor enum', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue({
                ...configKey,
                controls: [
                    {
                        label: 'Mode',
                        name: 'mode',
                        type: DeviceConfigItemType.String,
                        path: 'operation_mode',
                        values: [{ label: 'Auto', name: 'auto', path: 'AUTO_MODE' }],
                    },
                ],
            });

            const result = await service.mapPayloadFromDevice(configKey, 'controls', { operation_mode: 'AUTO_MODE' });

            expect(result).toEqual({ mode: 'AUTO_MODE' });
        });
    });

    describe('categorizeAndMapPayloadFromDevice', () => {
        it('should categorize the payload fields into commands/controls/measurements', async () => {
            const result = await service.categorizeAndMapPayloadFromDevice(configKey, {
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
            const result = await service.categorizeAndMapPayloadFromDevice(configKey, { battery: 95, unknown_field: 1 });

            expect(result).toEqual({ commands: {}, controls: {}, measurements: { battery: 95 } });
        });

        it('should return empty sections when there is no config for the device', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue(null);

            const result = await service.categorizeAndMapPayloadFromDevice(configKey, { battery: 95 });

            expect(result).toEqual({ commands: {}, controls: {}, measurements: {} });
        });

        it('should drop a boolean field when the config item declares no values', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue(valuelessBooleanConfig);

            const result = await service.categorizeAndMapPayloadFromDevice(configKey, { state: 'ON' });

            expect(result).toEqual({ commands: {}, controls: {}, measurements: {} });
        });

        it('should drop a field whose value is not declared by the matching enum item', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue(enumConfig);

            const result = await service.categorizeAndMapPayloadFromDevice(configKey, { operation_mode: 'ECO_MODE' });

            expect(result).toEqual({ commands: {}, controls: {}, measurements: {} });
        });

        it('should categorize an enum field into controls with the internal value', async () => {
            mockDeviceConfigsService.getConfig.mockResolvedValue(enumConfig);

            const result = await service.categorizeAndMapPayloadFromDevice(configKey, { operation_mode: 'AUTO_MODE' });

            expect(result).toEqual({ commands: {}, controls: { mode: 'auto' }, measurements: {} });
        });
    });
});
