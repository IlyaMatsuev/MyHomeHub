import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { ScenarioDeviceDto, ScenarioTriggerDto } from 'scenarios/dto/common.dto';

@ApiSchema({ name: 'ScenarioResponse', description: 'Scenario entity returned in API responses' })
export class ScenarioResponseDto {
    @ApiProperty({ description: 'Unique external identifier (UUID)', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    externalId: string;

    @ApiProperty({ description: 'Scenario name' })
    name: string;

    @ApiProperty({ description: 'Scenario description', required: false })
    description?: string;

    @ApiProperty({ description: 'Scenario group name', required: false })
    group?: string;

    @ApiProperty({ description: 'Whether scenario is active' })
    active: boolean;

    @ApiProperty({ description: 'Number of times to repeat the scenario', required: false })
    repeatTimes?: number;

    @ApiProperty({ description: 'Scenario trigger configuration', type: ScenarioTriggerDto })
    trigger: ScenarioTriggerDto;

    @ApiProperty({ description: 'Devices affected by this scenario', type: [ScenarioDeviceDto] })
    devices: Array<ScenarioDeviceDto>;

    @ApiProperty({ description: 'Record creation timestamp' })
    createdAt: Date;

    @ApiProperty({ description: 'Record update timestamp' })
    updatedAt: Date;
}
