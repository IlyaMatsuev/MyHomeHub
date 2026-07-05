import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'common/dto';
import { IsBooleanValue } from 'common/decorators';
import { Room } from 'devices/interfaces';

@ApiSchema({ name: 'Devices.GetDevices', description: 'Parameters used to query devices' })
export class GetDevicesDto extends PaginationDto {
    @IsOptional()
    @IsEnum(Room)
    @ApiProperty({
        required: false,
        description: 'Filter devices by room',
        enum: Room,
    })
    room?: Room;

    @IsOptional()
    @IsBooleanValue()
    @ApiProperty({
        required: false,
        description: 'Include the device config (available commands/controls/measurements metadata) in the response',
    })
    includeConfig?: boolean;
}
