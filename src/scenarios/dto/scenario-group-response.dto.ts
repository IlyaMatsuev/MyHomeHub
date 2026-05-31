import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'ScenarioGroupResponse', description: 'Scenario group entity returned in API responses' })
export class ScenarioGroupResponseDto {
    @ApiProperty({ description: 'Group name' })
    name: string;

    @ApiProperty({ description: 'Number of scenarios in this group' })
    scenariosCount: number;

    @ApiProperty({ description: 'Record creation timestamp' })
    createdAt: Date;

    @ApiProperty({ description: 'Record update timestamp' })
    updatedAt: Date;
}
