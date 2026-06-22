import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'Scenarios.ScenarioGroupResponse', description: 'Scenario group entity returned in API responses' })
export class ScenarioGroupResponseDto {
    @ApiProperty({ description: 'Group name', example: 'favourites' })
    name: string;

    @ApiProperty({ description: 'Number of scenarios in this group', example: 2 })
    scenariosCount: number;

    @ApiProperty({ description: 'Record creation timestamp (Unix epoch in milliseconds)', type: Number })
    createdAt: number;

    @ApiProperty({ description: 'Record update timestamp (Unix epoch in milliseconds)', type: Number })
    updatedAt: number;
}
