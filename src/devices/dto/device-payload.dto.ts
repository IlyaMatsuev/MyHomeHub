import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { DeviceControls, DevicePayload } from 'devices/interfaces';

@ApiSchema({ name: 'Devices.DevicePayload', description: 'DTO describing the structure of controls or measurements payloads' })
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

@ApiSchema({ name: 'Devices.DeviceControls', description: 'DTO describing the structure of a generic controls payload' })
export class DeviceControlsDto extends DevicePayloadDto implements DeviceControls {
    @IsBoolean()
    @IsOptional()
    @ApiProperty({
        required: false,
        description: `Determines if the device should be turned on or off`,
    })
    on?: boolean;
}
