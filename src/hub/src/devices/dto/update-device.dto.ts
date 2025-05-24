import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { DeviceType, Room } from 'devices/interfaces';
import { IsEnum, IsInt, IsIP, IsNotEmptyObject, IsObject, IsOptional, IsString, Length, Min } from 'class-validator';
import {
    DEVICE_ALLOWED_IP_VERSION,
    DEVICE_DEFAULT_UPDATE_INTERVAL,
    DEVICE_NAME_MAX_LENGTH,
    DEVICE_NAME_MIN_LENGTH,
} from 'devices/devices.constants';

@ApiSchema({
    name: 'UpdateDeviceRequest',
    description: 'DTO used to update an existing device information, controls state or measurements',
})
export class UpdateDeviceDto {
    @IsOptional()
    @IsString()
    @Length(DEVICE_NAME_MIN_LENGTH, DEVICE_NAME_MAX_LENGTH)
    @ApiProperty({
        required: false,
        description: 'The new name for the device',
        minLength: DEVICE_NAME_MIN_LENGTH,
        maxLength: DEVICE_NAME_MAX_LENGTH,
    })
    name?: string;

    @IsOptional()
    @IsEnum(DeviceType)
    @ApiProperty({
        required: false,
        description: 'The new type for the device',
        enum: DeviceType,
    })
    type?: DeviceType;

    @IsOptional()
    @IsEnum(Room)
    @ApiProperty({
        required: false,
        description: 'The new room for the device',
        enum: Room,
    })
    room?: Room;

    @IsOptional()
    @IsInt()
    @Min(DEVICE_DEFAULT_UPDATE_INTERVAL)
    @ApiProperty({
        required: false,
        description: 'The new update time interval for the device (ms)',
        minimum: DEVICE_DEFAULT_UPDATE_INTERVAL,
    })
    updateInterval?: number;

    @IsOptional()
    @IsIP(DEVICE_ALLOWED_IP_VERSION)
    @ApiProperty({
        required: false,
        description: 'The IP address of the device',
    })
    ip?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({
        required: false,
        description: 'The new device ID of the Tuya smart device',
    })
    tuyaDeviceId?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({
        required: false,
        description: 'The new device local key of the Tuya smart device',
    })
    tuyaDeviceLocalKey?: string;

    @IsOptional()
    @IsNotEmptyObject()
    @IsObject()
    @ApiProperty({
        required: false,
        description: 'Updated set of controls for the device',
        default: {},
    })
    controls?: Record<string, object>;

    @IsOptional()
    @IsNotEmptyObject()
    @IsObject()
    @ApiProperty({
        required: false,
        description: 'Updated set of measurements for the device',
        default: {},
    })
    measurements?: Record<string, object>;

    get controlsUpdated(): boolean {
        return !!Object.keys(this.controls ?? {}).length;
    }

    get measurementsUpdated(): boolean {
        return !!Object.keys(this.measurements ?? {}).length;
    }

    constructor(controls?: Record<string, object>, measurements?: Record<string, object>) {
        if (controls) {
            this.controls = controls;
        }
        if (measurements) {
            this.measurements = measurements;
        }
    }
}

export class UpdateDeviceStateDto {
    controls: Record<string, object>;
    measurements?: Record<string, object>;
}
