import { Injectable } from '@nestjs/common';
import { DevicePayload } from 'devices/interfaces';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import {
    DEVICE_CONFIG_SECTIONS,
    DeviceConfig,
    DeviceConfigItem,
    DeviceConfigItemType,
    DeviceConfigKey,
    DeviceConfigSection,
    ParsedDeviceConfigPayload,
} from 'device-configs/interfaces';

@Injectable()
export class DeviceConfigsMapperService {
    constructor(private readonly deviceConfigsService: DeviceConfigsService) {}

    /**
     * Maps controls or commands for a specific device brand/type/api
     */
    async mapPayloadToDevice(key: DeviceConfigKey, payload: DevicePayload): Promise<DevicePayload> {
        const config = await this.deviceConfigsService.getConfig(key);
        // When setting controls using a device's API, there are no separation between commands and controls
        // Commands are the same as controls, they just do not get saved in the db
        // Measurements are excluded because you shouldn't be able to set them
        const configs = [...(config?.commands ?? []), ...(config?.controls ?? [])];
        if (!configs.length) {
            return payload;
        }

        const mapped: DevicePayload = {};
        for (const [name, value] of Object.entries(payload)) {
            const item = configs.find(configItem => configItem.name === name);
            if (item) {
                mapped[item.path ?? item.name] = this.mapValueToDevice(item, value);
            } else {
                mapped[name] = value;
            }
        }
        return mapped;
    }

    /**
     * Maps values from the device's API to a general format of commands, controls or measurements
     */
    async mapPayloadFromDevice(key: DeviceConfigKey, section: DeviceConfigSection, payload: DevicePayload): Promise<DevicePayload> {
        const config = await this.deviceConfigsService.getConfig(key);
        const items = config?.[section] ?? [];
        if (!items.length) {
            return payload;
        }

        const mapped: DevicePayload = {};
        for (const [name, value] of Object.entries(payload)) {
            const item = this.findConfigItem(items, name, value);
            if (item) {
                mapped[item.name] = this.mapValueFromDevice(item, value);
            } else {
                mapped[name] = value;
            }
        }
        return mapped;
    }

    /**
     * Categorizes a device payload into commands/controls/measurements based on the entries from device configs.
     * Fields not present in the config are dropped
     */
    async categorizeAndMapPayloadFromDevice(key: DeviceConfigKey, payload: DevicePayload): Promise<ParsedDeviceConfigPayload> {
        const parsedPayload: ParsedDeviceConfigPayload = { commands: {}, controls: {}, measurements: {} };
        const config = await this.deviceConfigsService.getConfig(key);
        if (!config) {
            return parsedPayload;
        }

        for (const [name, value] of Object.entries(payload)) {
            this.assignToSection(config, parsedPayload, name, value);
        }
        return parsedPayload;
    }

    private assignToSection(config: DeviceConfig, payload: ParsedDeviceConfigPayload, name: string, value: unknown): void {
        for (const section of DEVICE_CONFIG_SECTIONS) {
            const item = this.findConfigItem(config[section] ?? [], name, value);
            if (item) {
                payload[section][item.name] = this.mapValueFromDevice(item, value);
                return;
            }
        }
    }

    private findConfigItem(configs: Array<DeviceConfigItem>, name: string, value: unknown): DeviceConfigItem | undefined {
        return configs.find(item => {
            if ((item.path ?? item.name) !== name) {
                return false;
            }
            if (item.type === DeviceConfigItemType.Boolean || item.type === DeviceConfigItemType.Enum) {
                return item.values?.some(itemValue => itemValue.path === String(value) || itemValue.name === String(value));
            }
            return true;
        });
    }

    private mapValueToDevice(item: DeviceConfigItem, value: unknown): unknown {
        if (item.type === DeviceConfigItemType.Boolean || item.type === DeviceConfigItemType.Enum) {
            const mappedValue = item.values?.find(itemValue => itemValue.name === String(value));
            return mappedValue?.path ?? value;
        }
        return item.path ?? value;
    }

    private mapValueFromDevice(item: DeviceConfigItem, value: unknown): unknown {
        if (item.type === DeviceConfigItemType.Boolean || item.type === DeviceConfigItemType.Enum) {
            const mappedValue =
                item.values?.find(itemValue => itemValue.path === String(value)) ??
                item.values?.find(itemValue => itemValue.name === String(value));
            if (!mappedValue) {
                return value;
            }
            if (item.type === DeviceConfigItemType.Boolean) {
                return `${mappedValue.name}`.toLocaleLowerCase() === 'true';
            }
            return mappedValue.name;
        }
        if (item.type === DeviceConfigItemType.Number) {
            const numericValue = Number(value);
            return Number.isNaN(numericValue) ? value : numericValue;
        }
        return value;
    }
}
