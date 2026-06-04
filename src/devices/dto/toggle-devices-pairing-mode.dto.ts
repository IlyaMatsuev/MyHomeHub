import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_PAIRING_TIMEOUT_SECONDS, MIN_PAIRING_TIMEOUT_SECONDS } from 'devices/devices.constants';

@ApiSchema({ name: 'Devices.ToggleDevicesPairingMode', description: 'DTO for enabling/disabling pairing mode' })
export class ToggleDevicesPairingModeDto {
    @IsBoolean()
    @ApiProperty({
        required: true,
        description: 'Enable/disable pairing mode',
    })
    enable: boolean;

    @IsOptional()
    @IsInt()
    @Min(MIN_PAIRING_TIMEOUT_SECONDS)
    @Max(MAX_PAIRING_TIMEOUT_SECONDS)
    @ApiProperty({
        required: false,
        description: 'Duration in seconds to keep the pairing mode enabled',
        minimum: MIN_PAIRING_TIMEOUT_SECONDS,
        maximum: MAX_PAIRING_TIMEOUT_SECONDS,
        default: MAX_PAIRING_TIMEOUT_SECONDS,
    })
    seconds: number = MAX_PAIRING_TIMEOUT_SECONDS;
}
