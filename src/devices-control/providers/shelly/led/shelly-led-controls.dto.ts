import { ApiSchema } from '@nestjs/swagger';
import { IsEnum, IsHexColor, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import {
    SHELLY_LED_MIN_BRIGHTNESS,
    SHELLY_LED_MAX_BRIGHTNESS,
    SHELLY_LED_MIN_TEMPERATURE,
    SHELLY_LED_MAX_TEMPERATURE,
    SHELLY_LED_MIN_TRANSITION_DURATION,
    SHELLY_LED_MAX_TRANSITION_DURATION,
    ShellyLedMode,
} from '../shelly.constants';
import { ShellyControlsDto } from '../shelly-controls.dto';

@ApiSchema({ name: 'Devices.Shelly.LedControls', description: 'DTO describing the structure of Shelly LED device controls' })
export class ShellyLedControlsDto extends ShellyControlsDto {
    @IsOptional()
    @IsEnum(ShellyLedMode)
    mode?: ShellyLedMode;

    @IsOptional()
    @IsInt()
    @Min(SHELLY_LED_MIN_BRIGHTNESS)
    @Max(SHELLY_LED_MAX_BRIGHTNESS)
    brightness?: number;

    @IsOptional()
    @IsHexColor()
    color?: string;

    @IsOptional()
    @IsInt()
    @Min(SHELLY_LED_MIN_TEMPERATURE)
    @Max(SHELLY_LED_MAX_TEMPERATURE)
    temperature?: number;

    @IsOptional()
    @IsNumber()
    @Min(SHELLY_LED_MIN_TRANSITION_DURATION)
    @Max(SHELLY_LED_MAX_TRANSITION_DURATION)
    transitionDuration?: number;
}
