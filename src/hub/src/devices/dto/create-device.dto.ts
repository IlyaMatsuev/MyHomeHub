import { ApiProperty } from '@nestjs/swagger';
import { DeviceType, Room } from 'devices/interfaces/common';

// TODO: Add Swagger descriptions and other params for each property
export class CreateDeviceDto {
    @ApiProperty()
    name: string;

    @ApiProperty()
    type?: DeviceType;

    @ApiProperty()
    room: Room;

    @ApiProperty()
    updateInterval: number;

    @ApiProperty()
    controls: Record<string, object>;

    @ApiProperty()
    measurements: Record<string, object>;
}
