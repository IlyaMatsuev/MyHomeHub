import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { DeviceType, Room } from 'devices/interfaces';

@ApiSchema({
    name: 'UpdateDeviceRequest',
    description: 'DTO used to update an existing device information, controls state or measurements',
})
export class UpdateDeviceDto {
    @ApiProperty({
        required: false,
        description: 'The new name for the device',
        minLength: 3,
        maxLength: 20,
    })
    name?: string;

    @ApiProperty({
        required: false,
        description: 'The new type for the device',
        enum: DeviceType,
    })
    type?: DeviceType;

    @ApiProperty({
        required: false,
        description: 'The new room for the device',
        enum: Room,
    })
    room?: Room;

    @ApiProperty({
        required: false,
        description: 'The new update time interval for the device (ms)',
        minimum: 0,
    })
    updateInterval?: number;

    @ApiProperty({
        required: false,
        description: 'The IP address of the device',
    })
    deviceAddress?: string;

    @ApiProperty({
        required: false,
        description: 'Updated set of controls for the device',
        default: {},
    })
    controls?: Record<string, object>;

    @ApiProperty({
        required: false,
        description: 'Updated set of measurements for the device',
        default: {},
    })
    measurements?: Record<string, object>;
}

export class UpdateDeviceStateDto {
    controls: Record<string, object>;
    measurements?: Record<string, object>;
}
