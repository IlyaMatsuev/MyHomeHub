import { IsBoolean, IsOptional } from 'class-validator';
import { DevicePayloadDto } from 'devices/dto';

export class ShellyControlsDto extends DevicePayloadDto {
    @IsOptional()
    @IsBoolean()
    on?: boolean;
}
