import { Injectable } from '@nestjs/common';
import { DevicePayload } from 'devices/interfaces';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import {
    DeviceConfig,
    DeviceConfigItem,
    DeviceConfigItemType,
    DeviceConfigKey,
    DeviceConfigSection,
    SplitDevicePayload,
} from 'device-configs/interfaces';

const ALL_CONFIG_SECTIONS: Array<DeviceConfigSection> = ['commands', 'controls', 'measurements'];

@Injectable()
export class DeviceConfigsMapperService {
    constructor(private readonly deviceConfigsService: DeviceConfigsService) {}

    /**
     * Maps internal command/control names and values of an outgoing payload
     * to the device-side names defined by the device config ("path" fields)
     */
    async mapPayloadToDevice(key: DeviceConfigKey, payload: DevicePayload): Promise<DevicePayload> {
        const config = await this.deviceConfigsService.getConfig(key);
        const items = [...(config?.commands ?? []), ...(config?.controls ?? [])];
        if (!items.length) {
            return payload;
        }

        const mapped: DevicePayload = {};
        for (const [name, value] of Object.entries(payload)) {
            const item = items.find(configItem => configItem.name === name);
            if (item) {
                mapped[item.path ?? item.name] = this.mapValueToDevice(item, value);
            } else {
                mapped[name] = value;
            }
        }
        return mapped;
    }

    /**
     * Maps device-side names and values of an incoming payload back to the internal names
     * defined by the device config for the given section. Unknown fields are kept as-is
     */
    async mapPayloadFromDevice(key: DeviceConfigKey, section: DeviceConfigSection, payload: DevicePayload): Promise<DevicePayload> {
        const config = await this.deviceConfigsService.getConfig(key);
        const items = config?.[section] ?? [];
        if (!items.length) {
            return payload;
        }

        const mapped: DevicePayload = {};
        for (const [name, value] of Object.entries(payload)) {
            const item = this.findItemFromDevice(items, name, value);
            if (item) {
                mapped[item.name] = this.mapValueFromDevice(item, value);
            } else {
                mapped[name] = value;
            }
        }
        return mapped;
    }

    /**
     * Categorizes an incoming device payload into commands/controls/measurements
     * based on the device config entries. Fields not present in the config are dropped
     */
    async splitPayloadFromDevice(key: DeviceConfigKey, payload: DevicePayload): Promise<SplitDevicePayload> {
        const split: SplitDevicePayload = { commands: {}, controls: {}, measurements: {} };
        const config = await this.deviceConfigsService.getConfig(key);
        if (!config) {
            return split;
        }

        for (const [name, value] of Object.entries(payload)) {
            this.assignToSection(config, split, name, value);
        }
        return split;
    }

    private assignToSection(config: DeviceConfig, split: SplitDevicePayload, name: string, value: unknown): void {
        for (const section of ALL_CONFIG_SECTIONS) {
            const item = this.findItemFromDevice(config[section] ?? [], name, value);
            if (item) {
                split[section][item.name] = this.mapValueFromDevice(item, value);
                return;
            }
        }
    }

    private findItemFromDevice(items: Array<DeviceConfigItem>, name: string, value: unknown): DeviceConfigItem | undefined {
        return items.find(item => {
            if ((item.path ?? item.name) !== name) {
                return false;
            }
            if (item.values?.length) {
                return item.values.some(itemValue => itemValue.path === String(value) || itemValue.name === String(value));
            }
            return true;
        });
    }

    private mapValueToDevice(item: DeviceConfigItem, value: unknown): unknown {
        const mappedValue = item.values?.find(itemValue => itemValue.name === String(value));
        return mappedValue?.path ?? value;
    }

    private mapValueFromDevice(item: DeviceConfigItem, value: unknown): unknown {
        const mappedValue =
            item.values?.find(itemValue => itemValue.path === String(value)) ??
            item.values?.find(itemValue => itemValue.name === String(value));
        if (!mappedValue) {
            return value;
        }
        return this.castValue(mappedValue.name, item.type);
    }

    private castValue(value: string, type: DeviceConfigItemType): unknown {
        if (type === DeviceConfigItemType.Boolean) {
            return value === 'true';
        }
        if (type === DeviceConfigItemType.Number) {
            const numericValue = Number(value);
            return Number.isNaN(numericValue) ? value : numericValue;
        }
        return value;
    }
}
