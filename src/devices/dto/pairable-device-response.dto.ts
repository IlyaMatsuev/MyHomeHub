import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'Device.PairableDeviceResponse', description: 'Discoverable device that can be paired' })
export class PairableDeviceResponseDto {
    @ApiProperty({ description: 'Zigbee IEEE address', example: '0x00158d0001234567' })
    zigbeeIeeeAddress: string;

    @ApiProperty({ description: 'Zigbee friendly name' })
    zigbeeFriendlyName: string;
}
