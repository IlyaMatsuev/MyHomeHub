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
}
