import { readFileSync, readdirSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { resolve } from 'node:path';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import {
    DeviceConfig,
    DeviceConfigItem,
    DeviceConfigKey,
    ParsedDeviceConfig,
    DeviceConfigValidationPolicy,
    DEVICE_CONFIG_SECTIONS,
} from 'device-configs/interfaces';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';
import { DeviceConfigsParserService } from 'device-configs/device-configs-parser.service';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import { DeviceConfigsValidatorService } from 'device-configs/device-configs-validator.service';
import { validateItemValue } from 'device-configs/validators';

interface ShippedConfigItem {
    label: string;
    item: DeviceConfigItem;
}

describe('Shipped device configs', () => {
    const configsDir = resolve(__dirname, '../../../configs/devices');

    let debugSpy: jest.SpyInstance;

    beforeEach(() => {
        debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
        debugSpy.mockRestore();
    });

    const parseConfigs = (fileName: string): Array<ParsedDeviceConfig> => {
        const filePath = resolve(configsDir, fileName);
        return new DeviceConfigsParserService().parseFile(filePath, readFileSync(filePath, 'utf8'));
    };

    const createMapper = (config: ParsedDeviceConfig): DeviceConfigsMapperService => {
        const mockDeviceConfigsService = { getConfig: jest.fn().mockResolvedValue(config as DeviceConfig) };
        return new DeviceConfigsMapperService(mockDeviceConfigsService as unknown as DeviceConfigsService);
    };

    const createValidator = (config: ParsedDeviceConfig): DeviceConfigsValidatorService => {
        const mockDeviceConfigsService = { getConfig: jest.fn().mockResolvedValue(config as DeviceConfig) };
        return new DeviceConfigsValidatorService(mockDeviceConfigsService as unknown as DeviceConfigsService);
    };

    const allShippedItems = (): Array<ShippedConfigItem> => {
        return readdirSync(configsDir)
            .flatMap(fileName => parseConfigs(fileName))
            .flatMap(config =>
                DEVICE_CONFIG_SECTIONS.flatMap(section =>
                    (config[section] ?? []).map(item => ({ label: `${config.brand}/${config.type}/${section}.${item.name}`, item })),
                ),
            );
    };

    describe('philips.yaml', () => {
        const configKey: DeviceConfigKey = {
            brand: DeviceBrand.Philips,
            type: DeviceType.Remote,
            transportProtocol: TransportProtocol.Zigbee,
        };

        let mapper: DeviceConfigsMapperService;

        beforeEach(() => {
            const config = parseConfigs('philips.yaml').find(
                parsedConfig => parsedConfig.type === configKey.type && parsedConfig.transportProtocol === configKey.transportProtocol,
            );
            mapper = createMapper(config);
        });

        it('should categorize a remote button press into the on command and the measurements', async () => {
            const result = await mapper.categorizeAndMapPayloadFromDevice(configKey, {
                action: 'off_press',
                battery: 100,
                linkquality: 164,
                update: { state: 'idle' },
            });

            expect(result).toEqual({
                commands: { on: false },
                controls: {},
                measurements: { battery: 100, linkquality: 164 },
            });
        });

        it.each([
            ['on_press', 'on', true],
            ['off_press', 'on', false],
            ['up_press', 'brightness', true],
            ['down_press', 'brightness', false],
        ])('should map the "%s" action to the "%s" command', async (action, command, value) => {
            const result = await mapper.categorizeAndMapPayloadFromDevice(configKey, { action });

            expect(result.commands).toEqual({ [command]: value });
        });

        it('should drop the release action that follows the button press', async () => {
            const result = await mapper.categorizeAndMapPayloadFromDevice(configKey, { action: 'off_press_release' });

            expect(result.commands).toEqual({});
            expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('action'));
        });
    });

    describe('every shipped config item', () => {
        it('should declare a default value that satisfies its own rules', () => {
            const invalidDefaults = allShippedItems()
                .filter(({ item }) => item.default !== undefined)
                .map(({ label, item }) => ({ label, error: validateItemValue(item, item.default) }))
                .filter(({ error }) => error);

            expect(invalidDefaults).toEqual([]);
        });

        it('should declare a default value for every required control or measurement', () => {
            // A required command is provided by the caller on every request, so only the stored sections need a default
            const requiredWithoutDefault = allShippedItems()
                .filter(({ label }) => !label.includes('commands'))
                .filter(({ item }) => item.required && item.default === undefined)
                .map(({ label }) => label);

            expect(requiredWithoutDefault).toEqual([]);
        });
    });

    describe('shelly.yaml led validation', () => {
        const configKey: DeviceConfigKey = {
            brand: DeviceBrand.Shelly,
            type: DeviceType.LED,
            transportProtocol: TransportProtocol.Http,
        };

        let validator: DeviceConfigsValidatorService;

        beforeEach(() => {
            const config = parseConfigs('shelly.yaml').find(parsedConfig => parsedConfig.type === configKey.type);
            validator = createValidator(config);
        });

        const validateControls = (payload: Record<string, unknown>) => {
            return validator.validateSection(configKey, 'controls', payload, DeviceConfigValidationPolicy.Reject);
        };

        it('should accept a valid controls payload', async () => {
            const payload = { on: true, mode: 'rgb', brightness: 40, color: '#FF8800', temperature: 3000, transitionDuration: 1.5 };

            await expect(validateControls(payload)).resolves.toEqual(payload);
        });

        it.each([
            ['an unknown control', { loudness: 10 }],
            ['a wrong value type', { brightness: 'bright' }],
            ['an out of range number', { brightness: 500 }],
            ['a non integer brightness', { brightness: 40.5 }],
            ['an out of range color temperature', { temperature: 1000 }],
            ['a malformed hex color', { color: 'red' }],
            ['a value outside the declared enum', { mode: 'disco' }],
        ])('should reject %s', async (_label, payload) => {
            await expect(validateControls(payload)).rejects.toThrow();
        });

        it('should seed the led controls and measurements declared in the config', async () => {
            await expect(validator.buildDefaultPayloads(configKey)).resolves.toEqual({
                controls: { on: null, mode: null, brightness: null, color: null, temperature: null, transitionDuration: null },
                measurements: { power: null },
            });
        });
    });
});
