import { Injectable, Logger } from '@nestjs/common';
import { ValidationError } from 'common/interfaces';
import { CustomValidationException } from 'common/exceptions';
import { DevicePayload } from 'devices/interfaces';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import { getItemDefaultValue, isEmptyValue, validateItemValue } from 'device-configs/validators';
import {
    DeviceConfigPayloads,
    DeviceConfigItem,
    DeviceConfigKey,
    DeviceConfigSection,
    DeviceConfigValidationPolicy,
} from 'device-configs/interfaces';

interface PayloadValidationOptions {
    section: DeviceConfigSection;
    items: Array<DeviceConfigItem>;
    strict: boolean;
    policy: DeviceConfigValidationPolicy;
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
        return this.validatePayload(payload, {
            section,
            items: config[section],
            strict: config.strict !== false,
            policy,
        });
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

    private validatePayload(payload: DevicePayload, options: PayloadValidationOptions): DevicePayload | never {
        const errors: Array<ValidationError> = [];
        const droppedNames: Array<string> = [];
        const sanitized: DevicePayload = {};

        for (const [name, value] of Object.entries(payload)) {
            if (name === '$override') {
                sanitized.$override = value === true || value === 'true';
                continue;
            }
            const message = this.validateField(options, name, value);
            if (!message) {
                sanitized[name] = value;
                continue;
            }
            if (options.policy === DeviceConfigValidationPolicy.Reject) {
                errors.push({ message, path: `${options.section}.${name}`, value });
            } else {
                droppedNames.push(name);
            }
        }

        // Require field must always be present in the payload update,
        // Except when the update comes from devices - they should be able to update payload partially
        if (options.policy === DeviceConfigValidationPolicy.Reject) {
            errors.push(...this.validateRequiredItems(payload, options));
        }
        if (errors.length) {
            throw new CustomValidationException(...errors);
        }
        if (droppedNames.length) {
            this.logger.debug(`Dropped the invalid "${options.section}" payload fields: ${droppedNames.join(', ')}`);
        }
        return sanitized;
    }

    private validateField(options: PayloadValidationOptions, name: string, value: unknown): string | null {
        const item = options.items.find(configItem => configItem.name === name);
        if (!item) {
            return options.strict ? `"${name}" is not a known ${options.section} item of the device` : null;
        }
        return validateItemValue(item, value);
    }

    private validateRequiredItems(payload: DevicePayload, options: PayloadValidationOptions): Array<ValidationError> {
        return options.items
            .filter(item => item.required && isEmptyValue(payload[item.name]))
            .map(item => ({
                message: `"${item.name}" is required and must be provided with every ${options.section} update`,
                path: `${options.section}.${item.name}`,
                value: payload[item.name],
            }));
    }
}
