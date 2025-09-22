import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { DevicePayload } from 'devices/interfaces';

@ApiSchema({ name: 'DevicePayload', description: 'DTO describing the structure of controls or measurements payloads' })
export class DevicePayloadDto implements DevicePayload {
    @IsBoolean()
    @IsOptional()
    @ApiProperty({
        required: false,
        description: `Determines if the provided payload should override the existing device's value`,
    })
    $override?: boolean;

    [key: string]: unknown;
}
