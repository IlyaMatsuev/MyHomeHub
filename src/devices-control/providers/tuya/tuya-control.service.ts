import Color from 'color';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { TransportMessage, TuyaDeviceControls } from 'devices-control/interfaces';
import { TuyaControlsDto } from 'devices-control/providers';

const DEFAULT_MODE = 'colour';
const DEFAULT_COLOR = '#FFFFFF';
const DEFAULT_COLOR_BRIGHTNESS = 100;

enum TuyaControlsDps {
    On = 20,
    Mode = 21,
    Color = 24,
}

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

    protected async getControlsPayload(controls: object): Promise<TransportMessage> {
        return {
            tuyaId: this.tuyaDeviceId,
            ip: this.getDeviceIP(),
            localKey: this.tuyaDeviceLocalKey,
            payload: this.mapTuyaControls(controls as TuyaControlsDto),
        };
    }

    // TODO: Think how to map it more generically in some kind of config like yaml files
    private mapTuyaControls(controls: TuyaControlsDto): TuyaDeviceControls {
        const tuyaControls: TuyaDeviceControls = {
            [TuyaControlsDps.Mode]: DEFAULT_MODE,
        };
        if (controls.switched()) {
            tuyaControls[TuyaControlsDps.On] = !!controls.on;
        }
        if (controls.changedColor() || controls.changedBrightness()) {
            const currentControls: TuyaControlsDto = this.device.controls as TuyaControlsDto;
            const color = `${controls.color ?? currentControls?.color ?? DEFAULT_COLOR}`;
            let brightness = +(controls.brightness ?? currentControls?.brightness ?? DEFAULT_COLOR_BRIGHTNESS);
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
