import { ApiProperty } from '@nestjs/swagger';

export enum Room {
    LivingRoom = 'living-room'
}

// TODO: Add Swagger descriptions and other params for each property
export class DeviceDto {
    @ApiProperty()
    id: string;

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
