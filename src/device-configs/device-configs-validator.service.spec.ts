import { Logger } from '@nestjs/common';
import { CustomValidationException } from 'common/exceptions';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import {
    DeviceConfig,
    DeviceConfigItem,
    DeviceConfigItemFormat,
    DeviceConfigItemType,
    DeviceConfigKey,
    DeviceConfigValidationPolicy,
} from './interfaces';
import { DeviceConfigsService } from './device-configs.service';
import { DeviceConfigsValidatorService } from './device-configs-validator.service';

describe('DeviceConfigsValidatorService', () => {
    let service: DeviceConfigsValidatorService;
    let deviceConfigsService: { getConfig: jest.Mock };
    let debugSpy: jest.SpyInstance;

    const configKey: DeviceConfigKey = {
        brand: DeviceBrand.Shelly,
        type: DeviceType.LED,
        transportProtocol: TransportProtocol.Http,
    };

    const item = (overrides: Partial<DeviceConfigItem>): DeviceConfigItem =>
        ({ label: 'Label', name: 'name', type: DeviceConfigItemType.String, ...overrides }) as DeviceConfigItem;

    const mockConfig = (config: Partial<DeviceConfig>) => {
        deviceConfigsService.getConfig.mockResolvedValue({ ...configKey, ...config } as DeviceConfig);
    };

    const validateControls = (payload: Record<string, unknown>, policy = DeviceConfigValidationPolicy.Reject) => {
        return service.validateSection(configKey, 'controls', payload, policy);
    };

    const catchValidationError = async (validation: Promise<unknown>): Promise<CustomValidationException> => {
        try {
            await validation;
        } catch (error) {
            return error as CustomValidationException;
        }
        throw new Error('Expected the validation to throw a CustomValidationException');
    };

    beforeEach(() => {
        deviceConfigsService = { getConfig: jest.fn().mockResolvedValue(null) };
        service = new DeviceConfigsValidatorService(deviceConfigsService as unknown as DeviceConfigsService);
        debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
        debugSpy.mockRestore();
    });

    describe('validateSection', () => {
        it('should return the payload untouched when the device has no config', async () => {
            const payload = { whatever: 'anything' };

            await expect(validateControls(payload)).resolves.toBe(payload);
        });

        it('should reject every field of a section the config declares no items for', async () => {
            mockConfig({ controls: [] });

            await expect(validateControls({ whatever: 'anything' })).rejects.toThrow(
                '"whatever" is not a known controls item of the device',
            );
        });

        it('should accept a payload matching the declared items', async () => {
            mockConfig({
                controls: [
                    item({ name: 'on', type: DeviceConfigItemType.Boolean }),
                    item({ name: 'brightness', type: DeviceConfigItemType.Number, constraints: { min: 0, max: 100 } }),
                ],
            });
            const payload = { on: true, brightness: 40 };

            await expect(validateControls(payload)).resolves.toEqual(payload);
        });

        it('should reject an unknown control name', async () => {
            mockConfig({ controls: [item({ name: 'on', type: DeviceConfigItemType.Boolean })] });

            await expect(validateControls({ loudness: 10 })).rejects.toThrow(CustomValidationException);
        });

        it('should report the section and the field name in the error path', async () => {
            mockConfig({ controls: [item({ name: 'on', type: DeviceConfigItemType.Boolean })] });

            const error = await catchValidationError(validateControls({ on: 'yes' }));

            expect(error.getErrors()).toEqual([{ message: '"on" must be a boolean value', path: 'controls.on', value: 'yes' }]);
        });

        it('should accept an unknown control name when the config is not strict', async () => {
            mockConfig({ strict: false, controls: [item({ name: 'on', type: DeviceConfigItemType.Boolean })] });

            await expect(validateControls({ loudness: 10 })).resolves.toEqual({ loudness: 10 });
        });

        describe('the $override flag', () => {
            beforeEach(() => {
                mockConfig({ controls: [item({ name: 'on', type: DeviceConfigItemType.Boolean })] });
            });

            it('should always keep the flag, even though the config never declares it', async () => {
                await expect(validateControls({ $override: true, on: false })).resolves.toEqual({ $override: true, on: false });
            });

            it.each([
                ['the "true" string of a transport payload', 'true', true],
                ['the "false" string of a transport payload', 'false', false],
                ['a non boolean value', 1, false],
            ])('should coerce %s', async (_label, value, expected) => {
                await expect(validateControls({ $override: value, on: false })).resolves.toEqual({ $override: expected, on: false });
            });

            it('should not add the flag to a payload that does not carry it', async () => {
                await expect(validateControls({ on: false })).resolves.toEqual({ on: false });
            });
        });

        it('should accept a null value for an item that is not required', async () => {
            mockConfig({ controls: [item({ name: 'brightness', type: DeviceConfigItemType.Number })] });

            await expect(validateControls({ brightness: null })).resolves.toEqual({ brightness: null });
        });

        it.each([
            ['a boolean', DeviceConfigItemType.Boolean, 'true', '"name" must be a boolean value'],
            ['a number', DeviceConfigItemType.Number, '42', '"name" must be a number'],
            ['a string', DeviceConfigItemType.String, 42, '"name" must be a string'],
            ['an object', DeviceConfigItemType.Object, 'not an object', '"name" must be an object'],
        ])('should reject a value that is not %s', async (_label, type, value, message) => {
            mockConfig({ controls: [item({ type })] });

            const error = await catchValidationError(validateControls({ name: value }));

            expect(error.getMessages()).toEqual([message]);
        });

        it.each([
            [{ min: 10 }, 5, '"name" must not be less than 10'],
            [{ max: 10 }, 15, '"name" must not be greater than 10'],
            [{ integer: true }, 1.5, '"name" must be an integer number'],
        ])('should enforce the %s number constraint', async (constraints, value, message) => {
            mockConfig({ controls: [item({ type: DeviceConfigItemType.Number, constraints })] });

            const error = await catchValidationError(validateControls({ name: value }));

            expect(error.getMessages()).toEqual([message]);
        });

        it.each([
            [{ minLength: 3 }, 'ab', '"name" must be longer than or equal to 3 characters'],
            [{ maxLength: 3 }, 'abcd', '"name" must be shorter than or equal to 3 characters'],
            [{ pattern: '^a+$' }, 'abc', '"name" must match the ^a+$ pattern'],
        ])('should enforce the %s string constraint', async (constraints, value, message) => {
            mockConfig({ controls: [item({ type: DeviceConfigItemType.String, constraints })] });

            const error = await catchValidationError(validateControls({ name: value }));

            expect(error.getMessages()).toEqual([message]);
        });

        it('should reject a string that does not match the declared format', async () => {
            mockConfig({
                controls: [
                    item({ name: 'color', type: DeviceConfigItemType.String, constraints: { format: DeviceConfigItemFormat.HexColor } }),
                ],
            });

            await expect(validateControls({ color: '#FF00AA' })).resolves.toEqual({ color: '#FF00AA' });
            await expect(validateControls({ color: 'not-a-color' })).rejects.toThrow('"color" must be a valid hex-color value');
        });

        it('should reject an enum value that is not declared in the config', async () => {
            mockConfig({
                controls: [
                    item({
                        name: 'mode',
                        type: DeviceConfigItemType.Enum,
                        values: [
                            { label: 'Color', name: 'rgb' },
                            { label: 'White', name: 'cct' },
                        ],
                    }),
                ],
            });

            await expect(validateControls({ mode: 'rgb' })).resolves.toEqual({ mode: 'rgb' });
            await expect(validateControls({ mode: 'disco' })).rejects.toThrow('"mode" must be one of the following values: rgb, cct');
        });

        it('should collect every violation of the payload into a single exception', async () => {
            mockConfig({
                controls: [
                    item({ name: 'on', type: DeviceConfigItemType.Boolean }),
                    item({ name: 'brightness', type: DeviceConfigItemType.Number, constraints: { max: 100 } }),
                ],
            });

            const error = await catchValidationError(validateControls({ on: 'yes', brightness: 500, unknown: 1 }));

            expect(error.getMessages()).toEqual([
                '"on" must be a boolean value',
                '"brightness" must not be greater than 100',
                '"unknown" is not a known controls item of the device',
            ]);
        });

        describe('required items', () => {
            beforeEach(() => {
                mockConfig({
                    controls: [
                        item({ name: 'on', type: DeviceConfigItemType.Boolean, required: true }),
                        item({ name: 'brightness', type: DeviceConfigItemType.Number }),
                    ],
                });
            });

            it('should reject an update that does not provide the required control', async () => {
                await expect(validateControls({ brightness: 40 })).rejects.toThrow(
                    '"on" is required and must be provided with every controls update',
                );
            });

            it('should reject an update providing the required control as null', async () => {
                await expect(validateControls({ on: null, brightness: 40 })).rejects.toThrow(CustomValidationException);
            });

            it('should accept an update providing the required control', async () => {
                await expect(validateControls({ on: false, brightness: 40 })).resolves.toEqual({ on: false, brightness: 40 });
            });

            it('should not require the item for device originated updates', async () => {
                const result = await validateControls({ brightness: 40 }, DeviceConfigValidationPolicy.Sanitize);

                expect(result).toEqual({ brightness: 40 });
            });
        });

        describe('sanitize policy', () => {
            beforeEach(() => {
                mockConfig({
                    controls: [
                        item({ name: 'on', type: DeviceConfigItemType.Boolean }),
                        item({ name: 'brightness', type: DeviceConfigItemType.Number, constraints: { max: 100 } }),
                    ],
                });
            });

            it('should drop the invalid fields instead of rejecting the whole payload', async () => {
                const result = await validateControls({ on: true, brightness: 500 }, DeviceConfigValidationPolicy.Sanitize);

                expect(result).toEqual({ on: true });
            });

            it('should drop the unknown fields', async () => {
                const result = await validateControls({ on: true, junk: 'x' }, DeviceConfigValidationPolicy.Sanitize);

                expect(result).toEqual({ on: true });
            });

            it('should log the dropped field names', async () => {
                await validateControls({ on: true, junk: 'x' }, DeviceConfigValidationPolicy.Sanitize);

                expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('junk'));
            });
        });
    });

    describe('the commands section', () => {
        const validateCommand = (payload: Record<string, unknown>, policy = DeviceConfigValidationPolicy.Reject) => {
            return service.validateSection(configKey, 'commands', payload, policy);
        };

        it('should accept the declared commands', async () => {
            mockConfig({ commands: [item({ name: 'text', type: DeviceConfigItemType.String })] });

            await expect(validateCommand({ text: 'hello' })).resolves.toEqual({ text: 'hello' });
        });

        it('should reject a declared control sent as a command', async () => {
            mockConfig({
                commands: [item({ name: 'text', type: DeviceConfigItemType.String })],
                controls: [item({ name: 'on', type: DeviceConfigItemType.Boolean })],
            });

            await expect(validateCommand({ on: true })).rejects.toThrow('"on" is not a known commands item of the device');
        });

        it('should reject a command that is neither a declared command nor control', async () => {
            mockConfig({ commands: [item({ name: 'text', type: DeviceConfigItemType.String })] });

            await expect(validateCommand({ volume: 10 })).rejects.toThrow('"volume" is not a known commands item of the device');
        });

        it('should require the commands declared as required', async () => {
            mockConfig({ commands: [item({ name: 'text', type: DeviceConfigItemType.String, required: true })] });

            await expect(validateCommand({})).rejects.toThrow('"text" is required and must be provided with every commands update');
        });

        it('should not require the controls declared as required', async () => {
            mockConfig({
                commands: [item({ name: 'text', type: DeviceConfigItemType.String })],
                controls: [item({ name: 'on', type: DeviceConfigItemType.Boolean, required: true })],
            });

            await expect(validateCommand({ text: 'hello' })).resolves.toEqual({ text: 'hello' });
        });

        it('should return the payload untouched when the device has no config', async () => {
            const payload = { text: 'hello' };

            await expect(validateCommand(payload)).resolves.toBe(payload);
        });

        it('should reject every command when the config declares none', async () => {
            mockConfig({ commands: [], controls: [item({ name: 'on', type: DeviceConfigItemType.Boolean })] });

            await expect(validateCommand({ on: true })).rejects.toThrow('"on" is not a known commands item of the device');
        });

        it('should reject every command when the config declares no items at all', async () => {
            mockConfig({ commands: [], controls: [] });

            await expect(validateCommand({ text: 'hello' })).rejects.toThrow(CustomValidationException);
        });

        it('should drop every command of a device originated payload when the config declares none', async () => {
            mockConfig({ commands: [], controls: [item({ name: 'on', type: DeviceConfigItemType.Boolean })] });

            await expect(validateCommand({ on: true }, DeviceConfigValidationPolicy.Sanitize)).resolves.toEqual({});
        });
    });

    describe('buildDefaultPayloads', () => {
        it('should seed the declared items with their default values', async () => {
            mockConfig({
                controls: [
                    item({ name: 'on', type: DeviceConfigItemType.Boolean, default: false }),
                    item({ name: 'brightness', type: DeviceConfigItemType.Number, default: 50 }),
                ],
                measurements: [item({ name: 'power', type: DeviceConfigItemType.Number, default: 0 })],
            });

            await expect(service.buildDefaultPayloads(configKey)).resolves.toEqual({
                controls: { on: false, brightness: 50 },
                measurements: { power: 0 },
            });
        });

        it('should seed the items without a declared default with null', async () => {
            mockConfig({
                controls: [item({ name: 'on', type: DeviceConfigItemType.Boolean })],
                measurements: [item({ name: 'power', type: DeviceConfigItemType.Number })],
            });

            await expect(service.buildDefaultPayloads(configKey)).resolves.toEqual({
                controls: { on: null },
                measurements: { power: null },
            });
        });

        it('should return empty payloads when the device has no config', async () => {
            await expect(service.buildDefaultPayloads(configKey)).resolves.toEqual({ controls: {}, measurements: {} });
        });
    });
});
