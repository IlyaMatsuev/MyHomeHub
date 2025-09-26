import { IsOptional, IsString } from 'class-validator';
import { DeviceControlsDto } from 'devices/dto';

export class GoogleSpeakerControlsDto extends DeviceControlsDto {
    @IsOptional()
    @IsString()
    text?: string;
}
