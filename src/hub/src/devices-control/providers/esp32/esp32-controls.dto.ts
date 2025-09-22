import { IsBoolean, IsOptional } from 'class-validator';
import { DevicePayloadDto } from 'devices/dto';

export class Esp32ControlsDto extends DevicePayloadDto {
    @IsOptional()
    @IsBoolean()
    on?: boolean;
}
