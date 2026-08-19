import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Device, DeviceBrand, DevicePayload, DeviceType, Room } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import { DeviceConfigResponseDto } from 'device-configs/dto';

@ApiSchema({ name: 'Devices.DeviceResponse', description: 'Device entity returned in API responses' })
export class DeviceResponseDto implements Device {
    @ApiProperty({ description: 'Unique external identifier (UUID)', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    externalId: string;

    @ApiProperty({ description: 'Unique device name' })
    name: string;

    @ApiProperty({ description: 'Device type', enum: DeviceType })
    type: DeviceType;

    @ApiProperty({ description: 'Room where device is located', enum: Room })
    room: Room;

    @ApiProperty({ description: 'Device brand', enum: DeviceBrand })
    brand: DeviceBrand;

    @ApiProperty({ description: 'Transport protocol for communicating with the device', enum: TransportProtocol })
    transportProtocol: TransportProtocol;

    @ApiProperty({ description: 'Device IP address', required: false })
    ip?: string;

    @ApiProperty({ description: 'Tuya device ID', required: false })
    tuyaDeviceId?: string;

    @ApiProperty({ description: 'The device local key of the Tuya smart device', required: false })
    tuyaDeviceLocalKey?: string;

    @ApiProperty({ description: 'Zigbee friendly name', required: false })
    zigbeeFriendlyName?: string;

    @ApiProperty({ description: 'Zigbee IEEE address', required: false })
    zigbeeIeeeAddress?: string;

    @ApiProperty({ description: 'Update interval in milliseconds', required: false })
    updateInterval?: number;

    @ApiPropertyOptional({ description: 'Current device controls state', type: 'object', additionalProperties: true })
    controls?: DevicePayload;

    @ApiProperty({ description: 'Last controls update timestamp', required: false })
    controlsUpdatedAt?: Date;

    @ApiPropertyOptional({ description: 'Current device measurements', type: 'object', additionalProperties: true })
    measurements?: DevicePayload;

    @ApiProperty({ description: 'Last measurements update timestamp', required: false })
    measurementsUpdatedAt?: Date;

    @ApiPropertyOptional({
        description: 'Device config metadata (available commands/controls/measurements). Included only when requested with includeConfig',
        type: DeviceConfigResponseDto,
    })
    config?: DeviceConfigResponseDto;

    @ApiProperty({ description: 'Record creation timestamp' })
    createdAt: Date;

    @ApiProperty({ description: 'Record update timestamp' })
    updatedAt: Date;
}
