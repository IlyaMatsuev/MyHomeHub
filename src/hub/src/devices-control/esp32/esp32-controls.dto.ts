import { IsBoolean, IsOptional } from 'class-validator';

export class Esp32ControlsDto {
    @IsOptional()
    @IsBoolean()
    on?: boolean;
}
