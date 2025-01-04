import { ApiProperty } from '@nestjs/swagger';
import { Room } from 'devices/interfaces/common';

// TODO: Add Swagger descriptions and other params for each property
export class CreateDeviceDto {
    @ApiProperty()
    name: string;

    @ApiProperty()
    room: Room;

    @ApiProperty()
    updateInterval: number;

    @ApiProperty()
    controls: object;

    @ApiProperty()
    measurements: object;
}
