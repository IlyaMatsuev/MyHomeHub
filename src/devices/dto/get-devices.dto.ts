import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'common/dto';
import { Room } from 'devices/interfaces';

@ApiSchema({ name: 'GetDevicesParameters', description: 'Parameters used to query devices' })
export class GetDevicesDto extends PaginationDto {
    @IsOptional()
    @IsEnum(Room)
    @ApiProperty({
        required: false,
        description: 'Filter devices by room',
        enum: Room,
    })
    room?: Room;
}
