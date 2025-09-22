import { IsBoolean, IsOptional, IsNotEmpty, IsNumber } from 'class-validator';
import { Esp32ControlsDto } from '../esp32-controls.dto';

export class FanSpeedLevel {
    @IsNotEmpty()
    @IsNumber()
    highTemp: number;

    @IsNotEmpty()
    @IsNumber()
    lowTemp: number;
}

export class FansSpeedLevelsControls {
    @IsOptional()
    @IsBoolean()
    reset?: boolean;

    @IsOptional()
    0.25?: FanSpeedLevel;

    @IsOptional()
    0.5?: FanSpeedLevel;

    @IsOptional()
    1?: FanSpeedLevel;
}

export class Esp32FansControlsDto extends Esp32ControlsDto {
    @IsOptional()
    speedLevels?: FansSpeedLevelsControls;
}
