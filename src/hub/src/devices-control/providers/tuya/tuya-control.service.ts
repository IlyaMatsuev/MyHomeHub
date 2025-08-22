import TuyaDevice from 'tuyapi';
import Color from 'color';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { TuyaControlsDto } from 'devices-control/providers';

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

export class TuyaControlService extends DevicesControlService {
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
        return TuyaControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return TuyaControlsDto as ClassConstructor<T>;
    }

    protected async setDeviceControls(controls: object): Promise<void | never> {
        const controlsDto = controls as TuyaControlsDto;
        const tuyaDevice = new TuyaDevice({
            id: this.tuyaDeviceId,
            ip: this.getDeviceIP(),
            key: this.tuyaDeviceLocalKey,
            version: TUYA_DEVICE_PROTOCOL_VERSION,
        });
        const tuyaControls = this.mapTuyaControls(controlsDto);

        try {
            await tuyaDevice.connect();
            await tuyaDevice.set({ multiple: true, data: tuyaControls });
        } finally {
            tuyaDevice.disconnect();
        }
    }

    private mapTuyaControls(controls: TuyaControlsDto): TuyaDeviceControls {
        const tuyaControls: TuyaDeviceControls = {
            [TuyaControlsDps.Mode]: DEFAULT_MODE,
        };
        if (controls.switched()) {
            tuyaControls[TuyaControlsDps.On] = !!controls.on;
        }
        if (controls.changedColor() || controls.changedBrightness()) {
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
}
