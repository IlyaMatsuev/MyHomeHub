import { IsHexColor, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TUYA_DEVICE_MAX_BRIGHTNESS, TUYA_DEVICE_MIN_BRIGHTNESS } from 'devices-control/devices-control.constants';
import { DeviceControlsDto } from 'devices/dto';

export class TuyaControlsDto extends DeviceControlsDto {
    @IsOptional()
    @IsHexColor()
    color?: string;

    @IsOptional()
    @IsInt()
    @Min(TUYA_DEVICE_MIN_BRIGHTNESS)
    @Max(TUYA_DEVICE_MAX_BRIGHTNESS)
    brightness?: number;

    switched(): boolean {
        return this.controlProvided('on');
    }

    changedColor(): boolean {
        return this.controlProvided('color');
    }

    changedBrightness(): boolean {
        return this.controlProvided('brightness');
    }

    controlProvided(controlKey: keyof TuyaControlsDto): boolean {
        return this[controlKey] !== undefined && this[controlKey] !== null;
    }
}
