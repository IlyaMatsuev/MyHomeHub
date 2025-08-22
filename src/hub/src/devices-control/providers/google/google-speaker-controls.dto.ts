import { IsOptional, IsString } from 'class-validator';

export class GoogleSpeakerControlsDto {
    @IsOptional()
    @IsString()
    text?: string;
}
