import { IsOptional, IsString } from 'class-validator';
import { DevicePayloadDto } from 'devices/dto';

export class GoogleSpeakerControlsDto extends DevicePayloadDto {
    @IsOptional()
    @IsString()
    text?: string;
}
