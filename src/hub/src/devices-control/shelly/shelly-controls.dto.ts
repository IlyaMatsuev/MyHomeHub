import { IsBoolean, IsOptional } from 'class-validator';

export class ShellyControlsDto {
    @IsOptional()
    @IsBoolean()
    on?: boolean;
}
