import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

@ApiSchema({ name: 'ZigbeeRenameRequest', description: 'DTO for renaming a Zigbee device in Z2M' })
export class ZigbeeRenameDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({
        required: true,
        description: 'The IEEE address of the device to rename (e.g., 0x00158d0001234567)',
    })
    ieeeAddress: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({
        required: true,
        description: 'The new friendly name for the device',
    })
    friendlyName: string;

    constructor(dto?: Partial<ZigbeeRenameDto>) {
        if (dto) {
            Object.assign(this, dto);
        }
    }
}
