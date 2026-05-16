import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { DeviceControlsDto } from 'devices/dto';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

@ApiSchema({ name: 'PhilipsControls', description: 'DTO describing the structure of Philips device controls' })
export class PhilipsControlsDto extends DeviceControlsDto {
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    @ApiProperty({
        required: false,
        description: 'Brightness level for dimmable devices (0-100)',
        minimum: 0,
        maximum: 100,
    })
    brightness?: number;

    @IsOptional()
    @IsString()
    @ApiProperty({
        required: false,
        description: 'Color in hex format (e.g., #FF0000)',
    })
    color?: string;

    @IsOptional()
    @IsInt()
    @Min(153)
    @Max(500)
    @ApiProperty({
        required: false,
        description: 'Color temperature in mireds (153-500)',
        minimum: 153,
        maximum: 500,
    })
    colorTemp?: number;
}
