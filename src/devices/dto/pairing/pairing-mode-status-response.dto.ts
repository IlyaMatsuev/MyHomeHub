import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { MAX_PAIRING_TIMEOUT_SECONDS } from 'devices/devices.constants';

@ApiSchema({ name: 'Device.PairingModeStatusResponse', description: 'The status response showing if pairing mode is enabled' })
export class PairingModeStatusResponseDto {
    @ApiProperty({ description: 'Shows if pairing mode is enabled or disabled' })
    enabled: boolean;

    @ApiProperty({
        description: 'When pairing mode is enabled, shows the timeout until it becomes disabled',
        example: 0,
        maximum: MAX_PAIRING_TIMEOUT_SECONDS,
        default: MAX_PAIRING_TIMEOUT_SECONDS,
    })
    timeout: number;
}
