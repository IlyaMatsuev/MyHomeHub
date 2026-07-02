import { extname, basename } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { load as parseYaml } from 'js-yaml';
import { DeviceBrand, DeviceType } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfigItem, DeviceConfigItemType, ParsedDeviceConfig } from 'device-configs/interfaces';

type RawDeviceConfigItem = Partial<DeviceConfigItem> & { type?: string };
type RawProtocolBlock = {
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
            commands: this.normalizeItems(block.commands),
            controls: this.normalizeItems(block.controls),
            measurements: this.normalizeItems(block.measurements),
        };
    }

    private normalizeItems(items?: Array<RawDeviceConfigItem>): Array<DeviceConfigItem> | undefined {
        if (!Array.isArray(items) || !items.length) {
            return [];
        }
        return items.map(item => this.normalizeItem(item)).filter((item): item is DeviceConfigItem => item !== null);
    }

    private normalizeItem(item: RawDeviceConfigItem): DeviceConfigItem | null {
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
        };
        if (Array.isArray(item.values) && item.values.length) {
            normalized.values = item.values
                .filter(v => v && v.name !== undefined && v.label !== undefined)
                .map(v => ({ label: v.label, name: String(v.name), path: v.path }));
        }
        return normalized;
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
