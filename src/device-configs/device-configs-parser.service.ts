import { extname, basename } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { load as parseYaml } from 'js-yaml';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import {
    DeviceConfigItem,
    DeviceConfigItemConstraints,
    DeviceConfigItemFormat,
    DeviceConfigItemType,
    DeviceConfigSection,
    ParsedDeviceConfig,
} from 'device-configs/interfaces';
import { APPLICABLE_CONSTRAINTS, isEmptyValue, validateItemValue } from 'device-configs/validators';

type RawDeviceConfigItem = Partial<DeviceConfigItem> & { type?: string; constraints?: Record<string, unknown> };
type RawProtocolBlock = {
    strict?: boolean;
    commands?: Array<RawDeviceConfigItem>;
    controls?: Array<RawDeviceConfigItem>;
    measurements?: Array<RawDeviceConfigItem>;
};
type RawDeviceConfigFile = Record<string, Record<string, RawProtocolBlock>>;

@Injectable()
export class DeviceConfigsParserService {
    private readonly logger = new Logger(DeviceConfigsParserService.name);

    parseFile(filePath: string, fileContent: string): Array<ParsedDeviceConfig> {
        const brand = this.extractBrandFromFilename(filePath);
        if (!brand) {
            return [];
        }

        const parsed = this.safeParseYaml(filePath, fileContent);
        if (!parsed) {
            return [];
        }

        const configs: Array<ParsedDeviceConfig> = [];
        for (const [rawType, rawProtocols] of Object.entries(parsed)) {
            const type = this.toEnumValue(rawType, DeviceType);
            if (!type) {
                this.logger.warn(`Skipping unknown device type "${rawType}" in "${filePath}"`);
                continue;
            }
            if (!rawProtocols || typeof rawProtocols !== 'object') {
                this.logger.warn(`Skipping invalid protocol block for type "${rawType}" in "${filePath}"`);
                continue;
            }

            for (const [rawProtocol, block] of Object.entries(rawProtocols)) {
                const transportProtocol = this.toEnumValue(rawProtocol, TransportProtocol);
                if (!transportProtocol) {
                    this.logger.warn(`Skipping unknown transport protocol "${rawProtocol}" for type "${rawType}" in "${filePath}"`);
                    continue;
                }
                configs.push(this.buildConfig(brand, type, transportProtocol, block ?? {}));
            }
        }
        return configs;
    }

    private buildConfig(
        brand: DeviceBrand,
        type: DeviceType,
        transportProtocol: TransportProtocol,
        block: RawProtocolBlock,
    ): ParsedDeviceConfig {
        return {
            brand,
            type,
            transportProtocol,
            strict: block.strict !== false,
            commands: this.normalizeItems(block.commands, 'commands'),
            controls: this.normalizeItems(block.controls, 'controls'),
            measurements: this.normalizeItems(block.measurements, 'measurements'),
        };
    }

    private normalizeItems(items: Array<RawDeviceConfigItem> | undefined, section: DeviceConfigSection): Array<DeviceConfigItem> {
        if (!Array.isArray(items) || !items.length) {
            return [];
        }
        return items.map(item => this.normalizeItem(item, section)).filter((item): item is DeviceConfigItem => item !== null);
    }

    private normalizeItem(item: RawDeviceConfigItem, section: DeviceConfigSection): DeviceConfigItem | null {
        if (!item || !item.name || !item.label) {
            this.logger.warn(`Skipping config item without required "name"/"label" fields: ${JSON.stringify(item)}`);
            return null;
        }
        const type = this.toEnumValue(item.type, DeviceConfigItemType);
        if (!type) {
            this.logger.warn(`Skipping config item "${item.name}" with unknown type "${item.type}"`);
            return null;
        }
        const normalized: DeviceConfigItem = {
            label: item.label,
            name: item.name,
            type,
            description: item.description,
            path: item.path,
            required: item.required === true ? true : undefined,
            constraints: this.normalizeConstraints(item, type),
        };
        if (Array.isArray(item.values) && item.values.length) {
            normalized.values = item.values
                .filter(v => v && v.name !== undefined && v.label !== undefined)
                .map(v => ({ label: v.label, name: String(v.name), path: v.path }));
        }
        normalized.default = this.normalizeDefault(normalized, item.default, section);
        return normalized;
    }

    private normalizeConstraints(item: RawDeviceConfigItem, type: DeviceConfigItemType): DeviceConfigItemConstraints | undefined {
        const rawConstraints = item.constraints;
        if (!rawConstraints || typeof rawConstraints !== 'object') {
            return undefined;
        }

        const applicable = APPLICABLE_CONSTRAINTS[type];
        const constraints: DeviceConfigItemConstraints = {};
        for (const [name, value] of Object.entries(rawConstraints)) {
            if (!applicable.includes(name as keyof DeviceConfigItemConstraints)) {
                this.logger.warn(`Skipping the "${name}" constraint of the config item "${item.name}": not applicable to "${type}" items`);
                continue;
            }
            if (name === 'format' && !this.toEnumValue(String(value), DeviceConfigItemFormat)) {
                this.logger.warn(`Skipping the unknown format "${value}" of the config item "${item.name}"`);
                continue;
            }
            constraints[name] = value;
        }
        return Object.keys(constraints).length ? constraints : undefined;
    }

    private normalizeDefault(item: DeviceConfigItem, defaultValue: unknown, section: DeviceConfigSection): unknown {
        if (isEmptyValue(defaultValue)) {
            if (item.required && section !== 'commands') {
                this.logger.warn(`The required config item "${item.name}" does not declare a default value`);
            }
            return undefined;
        }
        const error = validateItemValue(item, defaultValue);
        if (error) {
            this.logger.warn(`Skipping the invalid default value of the config item "${item.name}": ${error}`);
            return undefined;
        }
        return defaultValue;
    }

    private safeParseYaml(filePath: string, content: string): RawDeviceConfigFile | null {
        try {
            const result = parseYaml(content);
            if (!result || typeof result !== 'object') {
                this.logger.warn(`Device config file "${filePath}" does not contain a YAML object`);
                return null;
            }
            return result as RawDeviceConfigFile;
        } catch (error) {
            this.logger.error(`Failed to parse device config file "${filePath}": ${(error as Error).message}`);
            return null;
        }
    }

    private extractBrandFromFilename(filePath: string): DeviceBrand | null {
        const name = basename(filePath, extname(filePath)).toLowerCase();
        const brand = this.toEnumValue(name, DeviceBrand);
        if (!brand) {
            this.logger.warn(`Skipping device config file "${filePath}": filename does not match any known DeviceBrand`);
            return null;
        }
        return brand;
    }

    private toEnumValue<T extends Record<string, string>>(value: string | undefined, enumObj: T): T[keyof T] | null {
        if (typeof value !== 'string') {
            return null;
        }
        const match = Object.values(enumObj).find(v => v === value);
        return (match as T[keyof T]) ?? null;
    }
}
