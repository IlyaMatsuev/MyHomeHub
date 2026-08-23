import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
    ZIGBEE_FRIENDLY_NAME_MAX_LENGTH,
    ZIGBEE_FRIENDLY_NAME_MIN_LENGTH,
    ZIGBEE_FRIENDLY_NAME_REGEX,
    ZIGBEE_FRIENDLY_NAME_REGEX_ERROR_MESSAGE,
} from 'common/common.constants';
import { DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import {
    IsEnum,
    IsInt,
    IsIP,
    IsNotEmptyObject,
    IsOptional,
    IsString,
    Length,
    Matches,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';
import {
    DEVICE_ALLOWED_IP_VERSION,
    DEVICE_DEFAULT_UPDATE_INTERVAL,
    DEVICE_NAME_MAX_LENGTH,
    DEVICE_NAME_MIN_LENGTH,
} from 'devices/devices.constants';
import { DeviceControlsDto, DevicePayloadDto } from 'devices/dto';
import { TransportProtocol } from 'devices-control/interfaces';

@ApiSchema({
    name: 'Devices.DeviceUpdate',
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
    @IsEnum(DeviceBrand)
    @ApiProperty({
        required: false,
        description:
            'The new brand for the device. Brand/protocol specific fields that no longer apply (e.g. `tuyaDeviceId` or `zigbeeFriendlyName`) are cleared automatically',
        enum: DeviceBrand,
    })
    brand?: DeviceBrand;

    @IsOptional()
    @IsEnum(Room)
    @ApiProperty({
        required: false,
        description: 'The new room for the device',
        enum: Room,
    })
    room?: Room;

    @IsOptional()
    @IsEnum(TransportProtocol)
    @ApiProperty({
        required: false,
        description:
            'The protocol to use for communicating with the device. Brand/protocol specific fields that no longer apply (e.g. `tuyaDeviceId` or `zigbeeFriendlyName`) are cleared automatically',
        enum: TransportProtocol,
    })
    transportProtocol?: TransportProtocol;

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
    @IsString()
    @MinLength(ZIGBEE_FRIENDLY_NAME_MIN_LENGTH)
    @MaxLength(ZIGBEE_FRIENDLY_NAME_MAX_LENGTH)
    @Matches(ZIGBEE_FRIENDLY_NAME_REGEX, { message: ZIGBEE_FRIENDLY_NAME_REGEX_ERROR_MESSAGE })
    @ApiProperty({
        required: false,
        pattern: ZIGBEE_FRIENDLY_NAME_REGEX,
        minLength: ZIGBEE_FRIENDLY_NAME_MIN_LENGTH,
        maxLength: ZIGBEE_FRIENDLY_NAME_MAX_LENGTH,
        description: 'The Z2M friendly name of the Zigbee device (used as MQTT topic suffix)',
    })
    zigbeeFriendlyName?: string;

    @IsOptional()
    @IsNotEmptyObject()
    @ValidateNested()
    @ApiProperty({
        required: false,
        description: 'Updated set of controls for the device. Merged into the stored ones unless "$override" is set',
        default: {},
    })
    controls?: DeviceControlsDto;

    @IsOptional()
    @IsNotEmptyObject()
    @ValidateNested()
    @ApiProperty({
        required: false,
        description: 'Updated set of measurements for the device. Merged into the stored ones unless "$override" is set',
        default: {},
    })
    measurements?: DevicePayloadDto;

    get controlsUpdated(): boolean {
        return !!Object.keys(this.controls ?? {}).length;
    }

    get measurementsUpdated(): boolean {
        return !!Object.keys(this.measurements ?? {}).length;
    }

    constructor(device?: Partial<UpdateDeviceDto>) {
        if (device) {
            Object.assign(this, device);
        }
    }
}
