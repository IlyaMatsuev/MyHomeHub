import {
    IsString,
    IsNotEmpty,
    Length,
    IsEnum,
    IsOptional,
    IsInt,
    Min,
    IsIP,
    IsNotEmptyObject,
    Matches,
    ValidateNested,
    MinLength,
    MaxLength,
} from 'class-validator';
import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
    ZIGBEE_FRIENDLY_NAME_MAX_LENGTH,
    ZIGBEE_FRIENDLY_NAME_MIN_LENGTH,
    ZIGBEE_FRIENDLY_NAME_REGEX,
    ZIGBEE_FRIENDLY_NAME_REGEX_ERROR_MESSAGE,
    ZIGBEE_IEEE_ADDRESS_REGEX,
    ZIGBEE_IEEE_ADDRESS_REGEX_ERROR_MESSAGE,
} from 'common/common.constants';
import { DeviceBrand, DeviceType, Room } from 'devices/interfaces';
import {
    DEVICE_ALLOWED_IP_VERSION,
    DEVICE_DEFAULT_UPDATE_INTERVAL,
    DEVICE_NAME_MAX_LENGTH,
    DEVICE_NAME_MIN_LENGTH,
} from 'devices/devices.constants';
import { DeviceControlsDto, DevicePayloadDto } from 'devices/dto';
import { TransportProtocol } from 'devices-control/interfaces';

@ApiSchema({ name: 'Devices.CreateDevice', description: 'DTO used to add a new device to the hub control' })
export class CreateDeviceDto {
    @IsString()
    @IsNotEmpty()
    @Length(DEVICE_NAME_MIN_LENGTH, DEVICE_NAME_MAX_LENGTH)
    @ApiProperty({
        required: true,
        description: 'The unique name of the device',
        minLength: DEVICE_NAME_MIN_LENGTH,
        maxLength: DEVICE_NAME_MAX_LENGTH,
    })
    name: string;

    @IsNotEmpty()
    @IsEnum(DeviceType)
    @ApiProperty({
        required: true,
        description: 'The type of the device',
        enum: DeviceType,
    })
    type: DeviceType;

    @IsOptional()
    @IsEnum(DeviceBrand)
    @ApiProperty({
        required: false,
        description: 'The brand of the device',
        enum: DeviceBrand,
    })
    brand: DeviceBrand;

    @IsOptional()
    @IsEnum(Room)
    @ApiProperty({
        required: false,
        description: 'The room where device is placed at',
        enum: Room,
    })
    room?: Room;

    @IsEnum(TransportProtocol)
    @ApiProperty({
        required: true,
        description: 'The protocol to use for communicating with the device',
        enum: TransportProtocol,
    })
    transportProtocol: TransportProtocol;

    @IsOptional()
    @IsInt()
    @Min(DEVICE_DEFAULT_UPDATE_INTERVAL)
    @ApiProperty({
        required: false,
        description:
            'Time interval of sending controls and measurements updates from devices to hub (ms). Setting to 0 means that device will not send updates itself',
        default: DEVICE_DEFAULT_UPDATE_INTERVAL,
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

    @IsNotEmpty()
    @IsString()
    @ApiProperty({
        required: false,
        description: 'The device ID of the Tuya smart device',
    })
    tuyaDeviceId?: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({
        required: false,
        description: 'The device local key of the Tuya smart device',
    })
    tuyaDeviceLocalKey?: string;

    @IsOptional()
    @IsString()
    @MinLength(ZIGBEE_FRIENDLY_NAME_MIN_LENGTH)
    @MaxLength(ZIGBEE_FRIENDLY_NAME_MAX_LENGTH)
    @Matches(ZIGBEE_FRIENDLY_NAME_REGEX, { message: ZIGBEE_FRIENDLY_NAME_REGEX_ERROR_MESSAGE })
    @ApiProperty({
        required: false,
        minLength: ZIGBEE_FRIENDLY_NAME_MIN_LENGTH,
        maxLength: ZIGBEE_FRIENDLY_NAME_MAX_LENGTH,
        pattern: ZIGBEE_FRIENDLY_NAME_REGEX,
        description: 'The Z2M friendly name of the Zigbee device (used as MQTT topic suffix)',
    })
    zigbeeFriendlyName?: string;

    @IsOptional()
    @IsString()
    @Matches(ZIGBEE_IEEE_ADDRESS_REGEX, { message: ZIGBEE_IEEE_ADDRESS_REGEX_ERROR_MESSAGE })
    @ApiProperty({
        required: false,
        pattern: ZIGBEE_IEEE_ADDRESS_REGEX,
        description: 'The IEEE address of the Zigbee device (e.g. 0x00158d0001234567)',
    })
    zigbeeIeeeAddress?: string;

    @IsOptional()
    @IsNotEmptyObject()
    @ValidateNested()
    @ApiProperty({
        required: true,
        description: 'Set of controls available to set for the device. Can be different for each device',
        default: {},
    })
    controls?: DeviceControlsDto;

    @IsOptional()
    @IsNotEmptyObject()
    @ValidateNested()
    @ApiProperty({
        required: true,
        description: 'Set of measurements available to read for the device. Can be different for each device',
        default: {},
    })
    measurements?: DevicePayloadDto;

    constructor(device?: Partial<CreateDeviceDto>) {
        if (device) {
            Object.assign(this, device);
        }
    }
}
