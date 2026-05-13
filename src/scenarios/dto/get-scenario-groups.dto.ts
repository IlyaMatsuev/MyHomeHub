import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from 'common/dto';
import { SCENARIO_GROUP_NAME_MAX_LENGTH } from 'scenarios/scenarios.constants';

@ApiSchema({ name: 'GetScenarioGroupsParameters', description: 'Parameters used to query scenario groups' })
export class GetScenarioGroupsDto extends PaginationDto {
    @IsOptional()
    @IsString()
    @MaxLength(SCENARIO_GROUP_NAME_MAX_LENGTH)
    @ApiProperty({
        required: false,
        description: 'Filter groups by name containing this term (case-insensitive)',
        maxLength: SCENARIO_GROUP_NAME_MAX_LENGTH,
    })
    term?: string;
}
