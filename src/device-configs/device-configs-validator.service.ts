import { Injectable, Logger } from '@nestjs/common';
import { ValidationError } from 'common/interfaces';
import { CustomValidationException } from 'common/exceptions';
import { DevicePayload } from 'devices/interfaces';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import { getItemDefaultValue, isEmptyValue, validateItemValue } from 'device-configs/validators';
import {
    DEVICE_CONFIG_SECTIONS,
    DeviceConfig,
    DeviceConfigPayloads,
    DeviceConfigItem,
    DeviceConfigKey,
    DeviceConfigSection,
    DeviceConfigValidationPolicy,
} from 'device-configs/interfaces';

interface PayloadValidationOptions {
    config: DeviceConfig;
    section: DeviceConfigSection;
    strict: boolean;
    policy: DeviceConfigValidationPolicy;
    /**
     * Trigger conditions are matched field by field against whatever the device reports,
     * so an item the condition does not mention is not a missing required item
     */
    requirePresence: boolean;
}

@Injectable()
export class DeviceConfigsValidatorService {
    private readonly logger = new Logger(DeviceConfigsValidatorService.name);

    constructor(private readonly deviceConfigsService: DeviceConfigsService) {}

    /**
     * Validates commands, controls or measurements payload against the device config declared in the YAML files.
     * Every section is validated the same way: a device only accepts the items its config declares for that section.
     * The payload is expected to use the internal names
     */
    async validateSection(
        key: DeviceConfigKey,
        section: DeviceConfigSection,
        payload: DevicePayload,
        policy: DeviceConfigValidationPolicy,
    ): Promise<DevicePayload | never> {
        const config = await this.deviceConfigsService.getConfig(key);
        if (!config || !config[section]) {
            return payload;
        }
        return this.validatePayload(payload, this.buildOptions(config, section, policy));
    }

    /**
     * Collects the violations of a payload that is going to be written to a device (e.g. a scenario action)
     * instead of throwing, so that a caller validating several payloads can report all of them at once.
     * The rules are the ones the device update itself applies, a section the config does not declare included
     */
    async collectPayloadErrors(
        key: DeviceConfigKey,
        section: DeviceConfigSection,
        payload: DevicePayload,
    ): Promise<Array<ValidationError>> {
        const config = await this.deviceConfigsService.getConfig(key);
        if (!config || !config[section]) {
            return [];
        }
        return this.collectErrors(payload, this.buildOptions(config, section, DeviceConfigValidationPolicy.Reject));
    }

    /**
     * Collects the violations of a payload that is matched against what a device reports (e.g. a scenario
     * trigger condition). A device only ever holds the items its config declares, so unlike a write payload,
     * a condition on a section the config does not declare can never be met and is reported as an error
     */
    async collectConditionErrors(
        key: DeviceConfigKey,
        section: DeviceConfigSection,
        payload: DevicePayload,
    ): Promise<Array<ValidationError>> {
        const config = await this.deviceConfigsService.getConfig(key);
        if (!config) {
            return [];
        }
        const options = this.buildOptions(config, section, DeviceConfigValidationPolicy.Reject);
        return this.collectErrors(payload, { ...options, requirePresence: false });
    }

    /**
     * Builds the initial controls and measurements payloads for a newly added device.
     * Items without a declared default are seeded with "null" to expose the names the device supports
     */
    async buildDefaultPayloads(key: DeviceConfigKey): Promise<DeviceConfigPayloads> {
        const config = await this.deviceConfigsService.getConfig(key);
        return {
            controls: this.buildDefaultPayload(config?.controls),
            measurements: this.buildDefaultPayload(config?.measurements),
        };
    }

    private buildDefaultPayload(items?: Array<DeviceConfigItem>): DevicePayload {
        return (items ?? []).reduce((payload, item) => {
            payload[item.name] = getItemDefaultValue(item);
            return payload;
        }, {} as DevicePayload);
    }

    private buildOptions(
        config: DeviceConfig,
        section: DeviceConfigSection,
        policy: DeviceConfigValidationPolicy,
    ): PayloadValidationOptions {
        return { config, section, strict: config.strict !== false, policy, requirePresence: true };
    }

    private validatePayload(payload: DevicePayload, options: PayloadValidationOptions): DevicePayload | never {
        if (options.policy === DeviceConfigValidationPolicy.Reject) {
            const errors = this.collectErrors(payload, options);
            if (errors.length) {
                throw new CustomValidationException(...errors);
            }
            return this.normalizeOverride(payload);
        }
        return this.sanitizePayload(payload, options);
    }

    private sanitizePayload(payload: DevicePayload, options: PayloadValidationOptions): DevicePayload {
        const droppedNames: Array<string> = [];
        const sanitized: DevicePayload = {};

        for (const [name, value] of Object.entries(payload)) {
            if (name === '$override') {
                continue;
            }
            if (this.validateField(options, name, value)) {
                droppedNames.push(name);
            } else {
                sanitized[name] = value;
            }
        }

        if (droppedNames.length) {
            this.logger.debug(`Dropped the invalid "${options.section}" payload fields: ${droppedNames.join(', ')}`);
        }
        return this.normalizeOverride(sanitized, payload);
    }

    // "$override" is a flag of the payload rather than an item of the device config, so it is never validated
    private normalizeOverride(payload: DevicePayload, source: DevicePayload = payload): DevicePayload {
        const normalized = { ...payload };
        if ('$override' in source) {
            const flag: unknown = source.$override;
            normalized.$override = flag === true || flag === 'true';
        }
        return normalized;
    }

    private collectErrors(payload: DevicePayload, options: PayloadValidationOptions): Array<ValidationError> {
        const errors: Array<ValidationError> = [];
        for (const [name, value] of Object.entries(payload)) {
            if (name === '$override') {
                continue;
            }
            const message = this.validateField(options, name, value);
            if (message) {
                errors.push({ message, path: `${options.section}.${name}`, value });
            }
        }

        // A required item must be present in every payload update,
        // Except when the update comes from devices - they should be able to update the payload partially
        if (options.requirePresence) {
            errors.push(...this.validateRequiredItems(payload, options));
        }
        return errors;
    }

    private validateField(options: PayloadValidationOptions, name: string, value: unknown): string | null {
        const item = this.getItems(options).find(configItem => configItem.name === name);
        if (item) {
            return validateItemValue(item, value);
        }
        if (!options.strict) {
            return null;
        }
        const declaredIn = this.findDeclaringSection(options, name);
        return declaredIn
            ? `"${name}" is declared as a "${declaredIn}" item of the device, not "${options.section}"`
            : `"${name}" is not a known ${options.section} item of the device`;
    }

    /**
     * Tells a name that belongs to another section apart from a name the device does not know at all,
     * so that e.g. a control used as a command is not reported as a typo
     */
    private findDeclaringSection(options: PayloadValidationOptions, name: string): DeviceConfigSection | undefined {
        return DEVICE_CONFIG_SECTIONS.find(
            section => section !== options.section && (options.config[section] ?? []).some(item => item.name === name),
        );
    }

    private getItems(options: PayloadValidationOptions): Array<DeviceConfigItem> {
        return options.config[options.section] ?? [];
    }

    private validateRequiredItems(payload: DevicePayload, options: PayloadValidationOptions): Array<ValidationError> {
        return this.getItems(options)
            .filter(item => item.required && isEmptyValue(payload[item.name]))
            .map(item => ({
                message: `"${item.name}" is required and must be provided with every ${options.section} update`,
                path: `${options.section}.${item.name}`,
                value: payload[item.name],
            }));
    }
}
