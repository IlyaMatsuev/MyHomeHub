import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { PaginationDto } from 'common/dto';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SCENARIO_GROUP_NAME_MAX_LENGTH, SCENARIO_GROUP_NAME_PATTERN } from 'scenarios/scenarios.constants';

@ApiSchema({ name: 'GetScenariosParameters', description: 'Parameters used to query scenarios' })
export class GetScenariosDto extends PaginationDto {
    @IsBoolean()
    @ApiProperty({
        required: false,
        default: false,
        description: 'Determines if the response should also include inactive scenarios',
    })
    includeInactive: boolean = false;

    @IsOptional()
    @IsString()
    @MaxLength(SCENARIO_GROUP_NAME_MAX_LENGTH)
    @Matches(SCENARIO_GROUP_NAME_PATTERN, {
        message: 'Group name must contain only English letters, digits, and underscores, and cannot be digits only',
    })
    @ApiProperty({
        required: false,
        description: 'Filter scenarios by group name',
        maxLength: SCENARIO_GROUP_NAME_MAX_LENGTH,
    })
    group?: string;
}
