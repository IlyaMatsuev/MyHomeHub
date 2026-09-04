import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CustomValidationException } from 'common/exceptions';
import { Device, DeviceBrand, DeviceType } from 'devices/interfaces';
import { DevicesService } from 'devices/devices.service';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfig, DeviceConfigKey, ParsedDeviceConfig } from 'device-configs/interfaces';
import { DeviceConfigsParserService } from 'device-configs/device-configs-parser.service';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import { DeviceConfigsValidatorService } from 'device-configs/device-configs-validator.service';
import { ScenariosValidatorService } from 'scenarios/scenarios-validator.service';
import { CreateScenarioDto } from 'scenarios/dto';
import { ScenarioTriggerSourceType } from 'scenarios/interfaces';

/**
 * The reported case: a remote button put on the "controls" of a scenario trigger, where the shipped
 * config declares it as a command. The scenario used to be stored and then silently never fire
 */
describe('Scenario validation against the shipped device configs', () => {
    const configsDir = resolve(__dirname, '../../../configs/devices');

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

    let service: ScenariosValidatorService;

    const parseConfigs = (fileName: string): Array<ParsedDeviceConfig> => {
        const filePath = resolve(configsDir, fileName);
        return new DeviceConfigsParserService().parseFile(filePath, readFileSync(filePath, 'utf8'));
    };

    const findConfig = (configs: Array<ParsedDeviceConfig>, key: DeviceConfigKey): ParsedDeviceConfig | undefined => {
        return configs.find(
            config => config.brand === key.brand && config.type === key.type && config.transportProtocol === key.transportProtocol,
        );
    };

    const scenario = (overrides: Record<string, unknown>): CreateScenarioDto =>
        ({
            name: 'Main ceiling light On',
            trigger: { sources: [], logic: '1' },
            actions: [{ externalId: bulb.externalId, set: { controls: { on: true } } }],
            ...overrides,
        }) as unknown as CreateScenarioDto;

    const deviceTrigger = (conditions: Record<string, unknown>) => ({
        sources: [{ type: ScenarioTriggerSourceType.Device, device: { externalId: remote.externalId, ...conditions } }],
        logic: '1',
    });

    const catchValidationError = async (validation: Promise<unknown>): Promise<CustomValidationException> => {
        try {
            await validation;
        } catch (error) {
            return error as CustomValidationException;
        }
        throw new Error('Expected the validation to throw a CustomValidationException');
    };

    beforeEach(() => {
        const configs = [...parseConfigs('philips.yaml'), ...parseConfigs('shelly.yaml')];
        const deviceConfigsService = {
            getConfig: jest.fn().mockImplementation((key: DeviceConfigKey) => Promise.resolve(findConfig(configs, key) as DeviceConfig)),
        };
        const devicesService = {
            getDeviceByExternalId: jest
                .fn()
                .mockImplementation(externalId => Promise.resolve([remote, bulb].find(d => d.externalId === externalId) ?? null)),
        };
        service = new ScenariosValidatorService(
            devicesService as unknown as DevicesService,
            new DeviceConfigsValidatorService(deviceConfigsService as unknown as DeviceConfigsService),
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should reject a remote button used as a control condition', async () => {
        const payload = scenario({ trigger: deviceTrigger({ controls: { are: { on: true } } }) });

        const error = await catchValidationError(service.validateScenario(payload));

        expect(error.getErrors()).toEqual([
            {
                message: '"on" is declared as a "commands" item of the device, not "controls"',
                path: 'trigger.sources.0.device.controls.are.on',
                value: true,
            },
        ]);
    });

    it('should accept the same scenario once the button is used as a command condition', async () => {
        const payload = scenario({ trigger: deviceTrigger({ commands: { are: { on: true } } }) });

        await expect(service.validateScenario(payload)).resolves.toBeUndefined();
    });

    it('should accept a measurement condition of the remote', async () => {
        const payload = scenario({ trigger: deviceTrigger({ measurements: { are: { battery: 100 } } }) });

        await expect(service.validateScenario(payload)).resolves.toBeUndefined();
    });

    it('should reject a command condition the remote cannot report', async () => {
        const payload = scenario({ trigger: deviceTrigger({ commands: { are: { volume: 10 } } }) });

        const error = await catchValidationError(service.validateScenario(payload));

        expect(error.getMessages()).toEqual(['"volume" is not a known commands item of the device']);
    });

    it('should reject an action setting a control value the bulb cannot take', async () => {
        const payload = scenario({
            trigger: deviceTrigger({ commands: { are: { on: true } } }),
            actions: [{ externalId: bulb.externalId, set: { controls: { brightness: 200 } } }],
        });

        const error = await catchValidationError(service.validateScenario(payload));

        expect(error.getErrors()).toEqual([
            { message: '"brightness" must not be greater than 100', path: 'actions.0.set.controls.brightness', value: 200 },
        ]);
    });

    it('should report the trigger and the action violations of one scenario together', async () => {
        const payload = scenario({
            trigger: deviceTrigger({ controls: { are: { on: true } } }),
            actions: [{ externalId: bulb.externalId, set: { controls: { colour: '#FF2501' } } }],
        });

        const error = await catchValidationError(service.validateScenario(payload));

        expect(error.getErrors().map(e => e.path)).toEqual(['trigger.sources.0.device.controls.are.on', 'actions.0.set.controls.colour']);
    });
});
