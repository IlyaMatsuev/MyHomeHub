import { Injectable } from '@nestjs/common';
import { DevicePayload } from 'devices/interfaces';

export interface ZigbeeMappedState {
    controls: DevicePayload;
    measurements: DevicePayload;
}

@Injectable()
export class ZigbeeStateMapperService {
    private static readonly CONTROL_KEYS = new Set(['state', 'brightness', 'color', 'color_temp', 'color_mode']);
    private static readonly MEASUREMENT_KEYS = new Set([
        'battery',
        'linkquality',
        'temperature',
        'humidity',
        'pressure',
        'occupancy',
        'contact',
        'tamper',
        'water_leak',
        'illuminance',
        'illuminance_lux',
        'voltage',
        'current',
        'power',
        'energy',
        'action',
    ]);

    mapState(z2mPayload: Record<string, unknown>): ZigbeeMappedState {
        const controls: DevicePayload = {};
        const measurements: DevicePayload = {};

        for (const [key, value] of Object.entries(z2mPayload)) {
            if (ZigbeeStateMapperService.CONTROL_KEYS.has(key)) {
                const mappedControl = this.mapControl(key, value);
                Object.assign(controls, mappedControl);
            } else if (ZigbeeStateMapperService.MEASUREMENT_KEYS.has(key)) {
                measurements[key] = value;
            }
        }

        return { controls, measurements };
    }

    private mapControl(key: string, value: unknown): DevicePayload {
        switch (key) {
            case 'state':
                return { on: value === 'ON' };
            case 'brightness':
                return { brightness: Math.round((Number(value) / 254) * 100) };
            case 'color':
                if (typeof value === 'object' && value !== null) {
                    const colorObj = value as Record<string, unknown>;
                    if (colorObj.hex) {
                        return { color: String(colorObj.hex) };
                    }
                }
                return {};
            case 'color_temp':
                return { colorTemp: Number(value) };
            case 'color_mode':
                return { colorMode: value };
            default:
                return {};
        }
    }
}
