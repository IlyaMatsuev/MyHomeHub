import { ApiProperty } from '@nestjs/swagger';
import { Room } from 'devices/interfaces/common';

// TODO: Add Swagger descriptions and other params for each property
export class UpdateDeviceDto {
    @ApiProperty()
    name?: string;

    @ApiProperty()
    room?: Room;

    @ApiProperty()
    updateInterval?: number;

    @ApiProperty()
    controls?: Record<string, object>;

    @ApiProperty()
    measurements?: Record<string, object>;
}

export class UpdateDeviceStateDto {
    controls: Record<string, object>;
    measurements: Record<string, object>;
}
