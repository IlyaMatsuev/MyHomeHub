import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { DeviceControls, DevicePayload } from 'devices/interfaces';

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

@ApiSchema({ name: 'DeviceControls', description: 'DTO describing the structure of a generic controls payload' })
export class DeviceControlsDto extends DevicePayloadDto implements DeviceControls {
    @IsOptional()
    @IsInt()
    @Min(0)
    @ApiProperty({
        required: false,
        description: `Specifies the amount of ms before the device's "on" state is switched`,
    })
    $onSwitchDelay?: number;

    @IsBoolean()
    @IsOptional()
    @ApiProperty({
        required: false,
        description: `Determines if the device should be turned on or off`,
    })
    on?: boolean;
}
