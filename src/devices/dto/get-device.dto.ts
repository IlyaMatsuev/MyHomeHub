import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsBooleanValue } from 'common/decorators';

@ApiSchema({ name: 'Devices.GetDevice', description: 'Parameters used to query a single device' })
export class GetDeviceDto {
    @IsOptional()
    @IsBooleanValue()
    @ApiProperty({
        required: false,
        description: 'Include the device config (available commands/controls/measurements metadata) in the response',
    })
    includeConfig?: boolean;

    @IsOptional()
    @IsBooleanValue()
    @ApiProperty({
        required: false,
        description:
            'Read the current state from the device itself before responding, so the returned controls/measurements are up to date. ' +
            'The stored state is returned as is when the device is unreachable or cannot be polled',
    })
    fresh?: boolean;
}
