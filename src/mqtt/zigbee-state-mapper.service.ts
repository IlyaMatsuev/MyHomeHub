import { Injectable } from '@nestjs/common';
import { DevicePayload } from 'devices/interfaces';

export interface ZigbeeMappedState {
    controls: DevicePayload;
    measurements: DevicePayload;
}

@Injectable()
export class ZigbeeStateMapperService {
    private static readonly CONTROL_KEYS = new Set(['state']);
    private static readonly MEASUREMENT_KEYS = new Set(['battery']);

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
            default:
                return {};
        }
    }
}
