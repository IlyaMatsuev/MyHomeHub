import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsBooleanValue } from 'common/decorators';

@ApiSchema({ name: 'Scenarios.DeleteScenarioGroup', description: 'Parameters used to delete a scenario group' })
export class DeleteScenarioGroupDto {
    @IsOptional()
    @IsBooleanValue()
    @ApiProperty({
        required: false,
        description: 'If true, related scenarios will also be deleted. If false, related scenarios will have their group field cleared',
    })
    deleteScenarios?: boolean;
}
