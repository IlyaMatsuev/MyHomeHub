import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';

@ApiSchema({ name: 'Scenarios.DeleteScenarioGroup', description: 'Parameters used to delete a scenario group' })
export class DeleteScenarioGroupDto {
    @IsOptional()
    @IsBoolean()
    // "false" is implicitly converted to boolean before @Transform, so it's always true. Hence, the explicit String type
    @Type(() => String)
    @Transform(({ value }) => value === 'true' || value === '1' || value === true)
    @ApiProperty({
        required: false,
        description: 'If true, related scenarios will also be deleted. If false, related scenarios will have their group field cleared',
    })
    deleteScenarios?: boolean;
}
