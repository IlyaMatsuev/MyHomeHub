import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';
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

    @IsBoolean()
    @Type(() => String)
    @Transform(({ value }) => value === 'true' || value === '1' || value === true)
    @ApiProperty({
        required: false,
        default: false,
        description: 'When true, shows only devices without an assigned room (room is null/undefined)',
    })
    allowEmptyRoom: boolean = false;
}
