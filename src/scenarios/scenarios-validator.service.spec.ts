import { CustomValidationException } from 'common/exceptions';
import { Device, DeviceBrand, DeviceType } from 'devices/interfaces';
import { DevicesService } from 'devices/devices.service';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfigsValidatorService } from 'device-configs/device-configs-validator.service';
import { ScenariosValidatorService } from './scenarios-validator.service';
import { CreateScenarioDto } from './dto';
import { ScenarioTriggerSourceType } from './interfaces';

describe('ScenariosValidatorService', () => {
    let service: ScenariosValidatorService;
    let devicesService: { getDeviceByExternalId: jest.Mock };
    let deviceConfigsValidator: { collectConditionErrors: jest.Mock; collectPayloadErrors: jest.Mock };

    const remote = {
        externalId: 'remote-1',
        brand: DeviceBrand.Philips,
        type: DeviceType.Remote,
        transportProtocol: TransportProtocol.Zigbee,
    } as Device;

    const bulb = {
        externalId: 'bulb-1',
        brand: DeviceBrand.Shelly,
        type: DeviceType.LED,
        transportProtocol: TransportProtocol.Http,
    } as Device;

    /**
     * The condition and action payloads are typed as "Record<string, object>", while their values
     * are the plain primitives a device reports, so the fixtures are built untyped
     */
    const scenario = (overrides: Record<string, unknown> = {}): CreateScenarioDto =>
        ({
            name: 'Main ceiling light On',
            trigger: {
                sources: [{ type: ScenarioTriggerSourceType.Device, device: { externalId: remote.externalId, commands: { are: {} } } }],
                logic: '1',
            },
            actions: [{ externalId: bulb.externalId, set: { controls: {} } }],
            ...overrides,
        }) as unknown as CreateScenarioDto;

    const catchValidationError = async (validation: Promise<unknown>): Promise<CustomValidationException> => {
        try {
            await validation;
        } catch (error) {
            return error as CustomValidationException;
        }
        throw new Error('Expected the validation to throw a CustomValidationException');
    };

    beforeEach(() => {
        devicesService = {
            getDeviceByExternalId: jest
                .fn()
                .mockImplementation(externalId => Promise.resolve([remote, bulb].find(d => d.externalId === externalId) ?? null)),
        };
        deviceConfigsValidator = {
            collectConditionErrors: jest.fn().mockResolvedValue([]),
            collectPayloadErrors: jest.fn().mockResolvedValue([]),
        };
        service = new ScenariosValidatorService(
            devicesService as unknown as DevicesService,
            deviceConfigsValidator as unknown as DeviceConfigsValidatorService,
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('validateScenario', () => {
        it('should accept a scenario whose devices, sections and items all check out', async () => {
            await expect(service.validateScenario(scenario())).resolves.toBeUndefined();
        });

        it('should accept a scenario without a trigger and actions', async () => {
            await expect(service.validateScenario({ active: false })).resolves.toBeUndefined();
            expect(devicesService.getDeviceByExternalId).not.toHaveBeenCalled();
        });

        it('should reject a trigger source referring to a device that does not exist', async () => {
            const payload = scenario({
                trigger: {
                    sources: [{ type: ScenarioTriggerSourceType.Device, device: { externalId: 'gone', controls: { are: { on: true } } } }],
                    logic: '1',
                },
            });

            const error = await catchValidationError(service.validateScenario(payload));

            expect(error.getErrors()).toEqual([
                {
                    message: 'There is no device with the id "gone"',
                    path: 'trigger.sources.0.device.externalId',
                    value: 'gone',
                },
            ]);
        });

        it('should reject a trigger source without a device id', async () => {
            const payload = scenario({
                trigger: {
                    sources: [{ type: ScenarioTriggerSourceType.Device, device: { controls: { are: { on: true } } } }],
                    logic: '1',
                },
            });

            const error = await catchValidationError(service.validateScenario(payload));

            expect(error.getErrors()).toEqual([
                {
                    message: 'The id of the device is required to reference it in a scenario',
                    path: 'trigger.sources.0.device.externalId',
                    value: undefined,
                },
            ]);
        });

        it('should reject an action referring to a device that does not exist', async () => {
            const payload = scenario({ actions: [{ externalId: 'gone', set: { controls: { on: true } } }] });

            const error = await catchValidationError(service.validateScenario(payload));

            expect(error.getErrors()).toEqual([
                { message: 'There is no device with the id "gone"', path: 'actions.0.externalId', value: 'gone' },
            ]);
        });

        it('should report a trigger condition put on the wrong section under its place in the scenario', async () => {
            deviceConfigsValidator.collectConditionErrors.mockResolvedValue([
                { message: '"on" is not a known controls item of the device', path: 'controls.on', value: true },
            ]);
            const payload = scenario({
                trigger: {
                    sources: [
                        { type: ScenarioTriggerSourceType.Cron, cron: '24 20 * * *' },
                        {
                            type: ScenarioTriggerSourceType.Device,
                            device: { externalId: remote.externalId, controls: { are: { on: true } } },
                        },
                    ],
                    logic: '1 OR 2',
                },
            });

            const error = await catchValidationError(service.validateScenario(payload));

            expect(error.getErrors()).toEqual([
                {
                    message: '"on" is not a known controls item of the device',
                    path: 'trigger.sources.1.device.controls.are.on',
                    value: true,
                },
            ]);
        });

        it('should validate every declared condition section against the triggering device', async () => {
            const payload = scenario({
                trigger: {
                    sources: [
                        {
                            type: ScenarioTriggerSourceType.Device,
                            device: {
                                externalId: remote.externalId,
                                commands: { are: { on: true } },
                                measurements: { are: { battery: 100 } },
                            },
                        },
                    ],
                    logic: '1',
                },
            });

            await service.validateScenario(payload);

            expect(deviceConfigsValidator.collectConditionErrors).toHaveBeenCalledWith(remote, 'commands', { on: true });
            expect(deviceConfigsValidator.collectConditionErrors).toHaveBeenCalledWith(remote, 'measurements', { battery: 100 });
            expect(deviceConfigsValidator.collectConditionErrors).not.toHaveBeenCalledWith(remote, 'controls', expect.anything());
        });

        it('should report an action setting an item the device update would reject', async () => {
            deviceConfigsValidator.collectPayloadErrors.mockResolvedValue([
                { message: '"brightness" must be less than or equal to 100', path: 'controls.brightness', value: 200 },
            ]);
            const payload = scenario({
                actions: [{ externalId: bulb.externalId, set: { controls: { brightness: 200 } } }],
            });

            const error = await catchValidationError(service.validateScenario(payload));

            expect(error.getErrors()).toEqual([
                {
                    message: '"brightness" must be less than or equal to 100',
                    path: 'actions.0.set.controls.brightness',
                    value: 200,
                },
            ]);
        });

        it('should validate the action measurements as well', async () => {
            const payload = scenario({
                actions: [{ externalId: bulb.externalId, set: { measurements: { power: 1 } } }],
            });

            await service.validateScenario(payload);

            expect(deviceConfigsValidator.collectPayloadErrors).toHaveBeenCalledWith(bulb, 'measurements', { power: 1 });
            expect(deviceConfigsValidator.collectPayloadErrors).not.toHaveBeenCalledWith(bulb, 'controls', expect.anything());
        });

        it('should report the trigger and the action violations of one scenario together', async () => {
            deviceConfigsValidator.collectConditionErrors.mockResolvedValue([
                { message: 'condition is wrong', path: 'controls.on', value: true },
            ]);
            deviceConfigsValidator.collectPayloadErrors.mockResolvedValue([
                { message: 'action is wrong', path: 'controls.mode', value: 'x' },
            ]);
            const payload = scenario({
                trigger: {
                    sources: [
                        {
                            type: ScenarioTriggerSourceType.Device,
                            device: { externalId: remote.externalId, controls: { are: { on: true } } },
                        },
                    ],
                    logic: '1',
                },
                actions: [{ externalId: bulb.externalId, set: { controls: { mode: 'x' } } }],
            });

            const error = await catchValidationError(service.validateScenario(payload));

            expect(error.getErrors().map(e => e.path)).toEqual(['trigger.sources.0.device.controls.are.on', 'actions.0.set.controls.mode']);
        });

        it('should ignore the cron trigger sources', async () => {
            const payload = scenario({
                trigger: { sources: [{ type: ScenarioTriggerSourceType.Cron, cron: '24 20 * * *' }], logic: '1' },
            });

            await service.validateScenario(payload);

            expect(deviceConfigsValidator.collectConditionErrors).not.toHaveBeenCalled();
        });

        it('should look a device referred to by both the trigger and an action up only once', async () => {
            const payload = scenario({
                trigger: {
                    sources: [{ type: ScenarioTriggerSourceType.Device, device: { externalId: bulb.externalId, controls: { are: {} } } }],
                    logic: '1',
                },
                actions: [{ externalId: bulb.externalId, set: { controls: { on: true } } }],
            });

            await service.validateScenario(payload);

            expect(devicesService.getDeviceByExternalId).toHaveBeenCalledTimes(1);
            expect(devicesService.getDeviceByExternalId).toHaveBeenCalledWith(bulb.externalId, { strict: false });
        });
    });
});
