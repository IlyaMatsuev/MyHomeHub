import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { ScenarioActionDto, ScenarioTriggerDto } from 'scenarios/dto/common.dto';
import { Scenario } from 'scenarios/interfaces';

@ApiSchema({ name: 'Scenarios.ScenarioResponse', description: 'Scenario entity returned in API responses' })
export class ScenarioResponseDto implements Scenario {
    @ApiProperty({ description: 'Unique external identifier (UUID)', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    externalId: string;

    @ApiProperty({ description: 'Scenario name', example: 'Turn the lights on' })
    name: string;

    @ApiProperty({ description: 'Scenario description', required: false })
    description?: string;

    @ApiProperty({ description: 'Scenario group name', required: false, example: 'favourites' })
    group?: string;

    @ApiProperty({ description: 'Whether scenario is active' })
    active: boolean;

    @ApiProperty({ description: 'Number of times to repeat the scenario before it becomes inactive', required: false })
    repeatTimes?: number;

    @ApiProperty({ description: 'Scenario trigger configuration', type: ScenarioTriggerDto })
    trigger: ScenarioTriggerDto;

    @ApiProperty({ description: 'Actions performed on the devices by this scenario', type: ScenarioActionDto, isArray: true })
    actions: Array<ScenarioActionDto>;

    @ApiProperty({ description: 'Record creation timestamp' })
    createdAt: Date;

    @ApiProperty({ description: 'Record update timestamp' })
    updatedAt: Date;
}
