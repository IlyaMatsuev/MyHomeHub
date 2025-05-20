import { DeviceControlService } from 'devices/control-services';
import TuyaDevice from 'tuyapi';
import Color from 'color';

const TUYA_DEVICE_PROTOCOL_VERSION = '3.3';

const DEFAULT_MODE = 'colour';
const DEFAULT_COLOR = '#FFFFFF';
const DEFAULT_COLOR_BRIGHTNESS = 100;

enum TuyaControlsDps {
    On = 20,
    Mode = 21,
    Color = 24,
}

type TuyaDeviceControls = { [key: number]: boolean | string | number };

export class TuyaDeviceControlService extends DeviceControlService {
    private get tuyaDeviceId() {
        if (!this.device.tuyaDeviceId) {
            throw new Error(`The Tuya device with id "${this.device.externalId}" is missing a Tuya device Id`);
        }
        return this.device.tuyaDeviceId;
    }

    private get tuyaDeviceLocalKey() {
        if (!this.device.tuyaDeviceLocalKey) {
            throw new Error(`The Tuya device with id "${this.device.externalId}" is missing a Tuya device local key`);
        }
        return this.device.tuyaDeviceLocalKey;
    }

    protected getServiceName(): string {
        return TuyaDeviceControlService.name;
    }

    async setControls(controls: Record<string, unknown>): Promise<void> {
        const tuyaDevice = new TuyaDevice({
            id: this.tuyaDeviceId,
            ip: this.getDeviceIP(),
            key: this.tuyaDeviceLocalKey,
            version: TUYA_DEVICE_PROTOCOL_VERSION,
        });
        const tuyaControls = this.mapTuyaControls(controls);

        try {
            await tuyaDevice.connect();
            await tuyaDevice.set({ multiple: true, data: tuyaControls });
        } finally {
            tuyaDevice.disconnect();
        }
    }

    private mapTuyaControls(controls: Record<string, unknown>): TuyaDeviceControls {
        const tuyaControls: TuyaDeviceControls = {
            [TuyaControlsDps.Mode]: DEFAULT_MODE,
        };
        if (this.controlProvided(controls.on)) {
            tuyaControls[TuyaControlsDps.On] = !!controls.on;
        }
        if (this.controlProvided(controls.color) || this.controlProvided(controls.brightness)) {
            const color = `${controls.color ?? this.device.controls?.color ?? DEFAULT_COLOR}`;
            let brightness = +(controls.brightness ?? this.device.controls?.brightness ?? DEFAULT_COLOR_BRIGHTNESS);
            if (brightness < 1 || brightness > 100) {
                brightness = DEFAULT_COLOR_BRIGHTNESS;
            }
            tuyaControls[TuyaControlsDps.Color] = this.convertToTuyaColorFormat(color, brightness);
        }
        return tuyaControls;
    }

    private convertToTuyaColorFormat(hexColor: string, brightness: number): string {
        const color = Color(hexColor).hsv();

        const hue = Math.round(color.hue());
        const saturation = Math.round(color.saturationv() * 10);
        const value = Math.round(brightness * 10);

        const hHex = hue.toString(16).padStart(4, '0');
        const sHex = saturation.toString(16).padStart(4, '0');
        const vHex = value.toString(16).padStart(4, '0');

        return `${hHex}${sHex}${vHex}`.toLowerCase();
    }

    private controlProvided(control: unknown): boolean {
        return control !== undefined && control !== null;
    }
}
