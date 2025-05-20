import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { DeviceType, Room } from 'devices/interfaces';

@ApiSchema({ name: 'CreateDeviceRequest', description: 'DTO used to add a new device to the hub control' })
export class CreateDeviceDto {
    @ApiProperty({
        required: true,
        description: 'The unique name of the device',
        minLength: 3,
        maxLength: 20,
    })
    name: string;

    @ApiProperty({
        required: true,
        description: 'The type of the device',
        enum: DeviceType,
    })
    type: DeviceType;

    @ApiProperty({
        required: false,
        description: 'The room where device is placed at',
        enum: Room,
    })
    room?: Room;

    @ApiProperty({
        required: true,
        description:
            'Time interval of sending controls and measurements updates from devices to hub (ms). Setting to 0 means that device will not send updates itself',
        default: 0,
        minimum: 0,
    })
    updateInterval: number;

    @ApiProperty({
        required: false,
        description: 'The IP address of the device',
    })
    deviceAddress?: string;

    @ApiProperty({
        required: false,
        description: 'The device ID of the Tuya smart device',
    })
    tuyaDeviceId?: string;

    @ApiProperty({
        required: false,
        description: 'The device local key of the Tuya smart device',
    })
    tuyaDeviceLocalKey?: string;

    @ApiProperty({
        required: true,
        description: 'Set of controls available to set for the device. Can be different for each device',
        default: {},
    })
    controls: Record<string, object>;

    @ApiProperty({
        required: true,
        description: 'Set of measurements available to read for the device. Can be different for each device',
        default: {},
    })
    measurements: Record<string, object>;

    constructor(device?: Partial<CreateDeviceDto>) {
        if (device) {
            Object.assign(this, device);
        }
    }
}
