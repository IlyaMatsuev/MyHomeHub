import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { ScenarioGroup } from 'scenarios/interfaces';

@ApiSchema({ name: 'Scenarios.ScenarioGroupResponse', description: 'Scenario group entity returned in API responses' })
export class ScenarioGroupResponseDto implements ScenarioGroup {
    @ApiProperty({ description: 'Group name', example: 'favourites' })
    name: string;

    @ApiProperty({ description: 'Number of scenarios in this group', example: 2 })
    scenariosCount: number;

    @ApiProperty({ description: 'Record creation timestamp' })
    createdAt: Date;

    @ApiProperty({ description: 'Record update timestamp' })
    updatedAt: Date;
}
