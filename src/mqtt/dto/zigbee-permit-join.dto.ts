import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

@ApiSchema({ name: 'ZigbeePermitJoinRequest', description: 'DTO for enabling/disabling Zigbee device pairing' })
export class ZigbeePermitJoinDto {
    @IsBoolean()
    @ApiProperty({
        required: true,
        description: 'Enable or disable permit join mode',
    })
    enable: boolean;

    @IsOptional()
    @IsInt()
    // TODO: Use constants
    @Min(0)
    @Max(254)
    @ApiProperty({
        required: false,
        description: 'Duration in seconds to keep permit join enabled (0-254, 0 = disable)',
        minimum: 0,
        maximum: 254,
    })
    seconds?: number;

    constructor(dto?: Partial<ZigbeePermitJoinDto>) {
        if (dto) {
            Object.assign(this, dto);
        }
    }
}
