import { Injectable, Logger } from '@nestjs/common';
import { ValidationError } from 'common/interfaces';
import { CustomValidationException } from 'common/exceptions';
import { DevicePayload } from 'devices/interfaces';
import { DEVICE_PAYLOAD_OVERRIDE_KEY } from 'devices/devices.constants';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import { getItemDefaultValue, isEmptyValue, validateItemValue } from 'device-configs/validators';
import {
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
    // Apply rules from the device config
    strict: boolean;
    policy: DeviceConfigValidationPolicy;
    // Enforce the items the config declares as "required"
    strictPresence: boolean;
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
        return this.collectErrors(payload, { ...options, strictPresence: false });
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
        return { config, section, strict: config.strict !== false, policy, strictPresence: true };
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
            if (name === DEVICE_PAYLOAD_OVERRIDE_KEY) {
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

    private normalizeOverride(payload: DevicePayload, source: DevicePayload = payload): DevicePayload {
        const normalized = { ...payload };
        if (DEVICE_PAYLOAD_OVERRIDE_KEY in source) {
            const flag: unknown = source[DEVICE_PAYLOAD_OVERRIDE_KEY];
            normalized[DEVICE_PAYLOAD_OVERRIDE_KEY] = flag === true || flag === 'true';
        }
        return normalized;
    }

    private collectErrors(payload: DevicePayload, options: PayloadValidationOptions): Array<ValidationError> {
        const errors: Array<ValidationError> = [];
        for (const [name, value] of Object.entries(payload)) {
            if (name === DEVICE_PAYLOAD_OVERRIDE_KEY) {
                continue;
            }
            const message = this.validateField(options, name, value);
            if (message) {
                errors.push({ message, path: `${options.section}.${name}`, value });
            }
        }

        if (options.strictPresence) {
            errors.push(...this.validateRequiredItems(payload, options));
        }
        return errors;
    }

    private validateField(options: PayloadValidationOptions, name: string, value: unknown): string | null {
        const item = this.getItems(options).find(configItem => configItem.name === name);
        if (!item) {
            return options.strict ? `"${name}" is not a known ${options.section} item of the device` : null;
        }
        return validateItemValue(item, value);
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
