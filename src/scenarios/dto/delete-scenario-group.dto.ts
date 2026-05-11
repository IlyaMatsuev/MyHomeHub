import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

@ApiSchema({ name: 'DeleteScenarioGroupParameters', description: 'Parameters used to delete a scenario group' })
export class DeleteScenarioGroupDto {
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === '1' || value === true)
    @ApiProperty({
        required: false,
        description: 'If true, related scenarios will also be deleted. If false, related scenarios will have their group field cleared',
    })
    deleteScenarios?: boolean;
}
