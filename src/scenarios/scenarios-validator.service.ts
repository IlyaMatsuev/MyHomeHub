import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CustomValidationException } from 'common/exceptions';
import { ValidationError } from 'common/interfaces';
import { Device, DevicePayload } from 'devices/interfaces';
import { DevicesService } from 'devices/devices.service';
import { DeviceConfigsValidatorService } from 'device-configs/device-configs-validator.service';
import { DEVICE_CONFIG_PAYLOADS_SECTIONS, DEVICE_CONFIG_SECTIONS, DeviceConfigSection } from 'device-configs/interfaces';
import { CreateScenarioDto, UpdateScenarioDto } from 'scenarios/dto';
import { ScenarioAction, ScenarioDeviceTriggerSource, ScenarioTriggerSource, ScenarioTriggerSourceType } from 'scenarios/interfaces';

type ScenarioPayload = CreateScenarioDto | UpdateScenarioDto;

@Injectable()
export class ScenariosValidatorService {
    constructor(
        @Inject(forwardRef(() => DevicesService))
        private readonly devicesService: DevicesService,
        private readonly deviceConfigsValidator: DeviceConfigsValidatorService,
    ) {}

    /**
     * Rejects a scenario that refers to a device, a section or an item name the device does not have.
     * Such a scenario is stored happily, but its trigger can never be met and its actions always fail,
     * which is only visible in the debug logs of every evaluation.
     *
     * Only the submitted trigger and actions are validated, never the stored ones,
     * so that an existing scenario stays editable the same way a device payload update stays partial
     */
    async validateScenario(scenario: ScenarioPayload): Promise<void | never> {
        const devices = await this.resolveDevices(scenario);
        const errors = [
            ...(await this.validateTriggerSources(scenario.trigger?.sources ?? [], devices)),
            ...(await this.validateActions(scenario.actions ?? [], devices)),
        ];
        if (errors.length) {
            throw new CustomValidationException(...errors);
        }
    }

    private async validateTriggerSources(
        sources: Array<ScenarioTriggerSource>,
        devices: Map<string, Device>,
    ): Promise<Array<ValidationError>> {
        const errors: Array<ValidationError> = [];
        for (const [index, source] of sources.entries()) {
            if (source.type !== ScenarioTriggerSourceType.Device) {
                continue;
            }
            const deviceSource = source as ScenarioDeviceTriggerSource;
            const path = `trigger.sources.${index}.device`;
            const triggeringDevice = devices.get(deviceSource.device?.externalId);
            if (!triggeringDevice) {
                errors.push(this.buildUnknownDeviceError(deviceSource.device?.externalId, `${path}.externalId`));
                continue;
            }
            errors.push(...(await this.validateConditions(deviceSource, triggeringDevice, path)));
        }
        return errors;
    }

    private async validateConditions(source: ScenarioDeviceTriggerSource, device: Device, path: string): Promise<Array<ValidationError>> {
        const errors: Array<ValidationError> = [];
        for (const section of DEVICE_CONFIG_SECTIONS) {
            const conditions = source.device[section]?.are as DevicePayload;
            if (!conditions) {
                continue;
            }
            const sectionErrors = await this.deviceConfigsValidator.collectConditionErrors(device, section, conditions);
            errors.push(...this.rebasePaths(sectionErrors, section, `${path}.${section}.are`));
        }
        return errors;
    }

    private async validateActions(actions: Array<ScenarioAction>, devices: Map<string, Device>): Promise<Array<ValidationError>> {
        const errors: Array<ValidationError> = [];
        for (const [index, action] of actions.entries()) {
            const path = `actions.${index}`;
            const targetDevice = devices.get(action.externalId);
            if (!targetDevice) {
                errors.push(this.buildUnknownDeviceError(action.externalId, `${path}.externalId`));
                continue;
            }
            for (const section of DEVICE_CONFIG_PAYLOADS_SECTIONS) {
                const payload = action.set?.[section] as DevicePayload;
                if (!payload) {
                    continue;
                }
                const sectionErrors = await this.deviceConfigsValidator.collectPayloadErrors(targetDevice, section, payload);
                errors.push(...this.rebasePaths(sectionErrors, section, `${path}.set.${section}`));
            }
        }
        return errors;
    }

    private async resolveDevices(scenario: ScenarioPayload): Promise<Map<string, Device>> {
        const externalIds = new Set<string>(
            [
                ...(scenario.trigger?.sources ?? [])
                    .filter(source => source.type === ScenarioTriggerSourceType.Device)
                    .map(source => (source as ScenarioDeviceTriggerSource).device?.externalId),
                ...(scenario.actions ?? []).map(action => action.externalId),
            ].filter(Boolean),
        );
        const devices = await Promise.all(
            Array.from(externalIds).map(externalId => this.devicesService.getDeviceByExternalId(externalId, { strict: false })),
        );
        return new Map(devices.filter(Boolean).map(device => [device.externalId, device]));
    }

    /**
     * The device configs validator paths its errors by section ("controls.on"),
     * while the client needs to be pointed at the place in the scenario the section came from
     */
    private rebasePaths(errors: Array<ValidationError>, section: DeviceConfigSection, path: string): Array<ValidationError> {
        const sectionPrefix = `${section}.`;
        return errors.map(error => ({
            ...error,
            path: error.path.startsWith(sectionPrefix) ? `${path}.${error.path.slice(sectionPrefix.length)}` : `${path}.${error.path}`,
        }));
    }

    private buildUnknownDeviceError(externalId: string, path: string): ValidationError {
        const message = externalId
            ? `There is no device with the id "${externalId}"`
            : 'The id of the device is required to reference it in a scenario';
        return { message, path, value: externalId };
    }
}
