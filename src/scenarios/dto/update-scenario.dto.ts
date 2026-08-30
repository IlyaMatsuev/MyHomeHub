import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { ScenarioActionDto, ScenarioTriggerDto } from 'scenarios/dto/common.dto';
import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    Length,
    Matches,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';
import {
    SCENARIO_DESCRIPTION_MAX_LENGTH,
    SCENARIO_DESCRIPTION_MIN_LENGTH,
    SCENARIO_MINIMUM_REPEAT_TIMES,
    SCENARIO_NAME_MAX_LENGTH,
    SCENARIO_NAME_MIN_LENGTH,
    SCENARIO_GROUP_NAME_MAX_LENGTH,
    SCENARIO_GROUP_NAME_PATTERN,
    SCENARIO_GROUP_NAME_PATTERN_ERROR_MESSAGE,
    SCENARIO_GROUP_NAME_MIN_LENGTH,
} from 'scenarios/scenarios.constants';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'Scenarios.UpdateScenario', description: 'DTO used to update an existing scenario information or actions' })
export class UpdateScenarioDto {
    @IsOptional()
    @IsString()
    @Length(SCENARIO_NAME_MIN_LENGTH, SCENARIO_NAME_MAX_LENGTH)
    @ApiProperty({
        required: false,
        description: 'The new name for the scenario',
        minLength: SCENARIO_NAME_MIN_LENGTH,
        maxLength: SCENARIO_NAME_MAX_LENGTH,
    })
    name?: string;

    @IsOptional()
    @IsString()
    @Length(SCENARIO_DESCRIPTION_MIN_LENGTH, SCENARIO_DESCRIPTION_MAX_LENGTH)
    @ApiProperty({
        required: false,
        description: 'The new description for the scenario',
        minLength: SCENARIO_DESCRIPTION_MIN_LENGTH,
        maxLength: SCENARIO_DESCRIPTION_MAX_LENGTH,
    })
    description?: string;

    @IsOptional()
    @IsString()
    @MinLength(SCENARIO_GROUP_NAME_MIN_LENGTH)
    @MaxLength(SCENARIO_GROUP_NAME_MAX_LENGTH)
    @Matches(SCENARIO_GROUP_NAME_PATTERN, { message: SCENARIO_GROUP_NAME_PATTERN_ERROR_MESSAGE })
    @ApiProperty({
        required: false,
        description:
            'The new group name for the scenario. Must contain only English letters, digits, and underscores, and cannot be digits only',
        minLength: SCENARIO_GROUP_NAME_MIN_LENGTH,
        maxLength: SCENARIO_GROUP_NAME_MAX_LENGTH,
    })
    group?: string;

    @IsOptional()
    @IsBoolean()
    @ApiProperty({
        required: false,
        description: 'Determines if the scenario should be executed',
    })
    active?: boolean;

    @IsOptional()
    @IsInt()
    @Min(SCENARIO_MINIMUM_REPEAT_TIMES)
    @ApiProperty({
        required: false,
        description:
            'Determines the number of times the scenario needs to be executed. If not provided, repeat infinitely. Each scenario execution subtracts this value by one. After the last execution, the scenario becomes inactive and the field is set blank',
    })
    repeatTimes?: number;

    @IsOptional()
    @ValidateNested()
    @ApiProperty({
        required: false,
        description: 'The new trigger setup for the scenario',
    })
    trigger?: ScenarioTriggerDto;

    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => ScenarioActionDto)
    @ApiProperty({
        type: ScenarioActionDto,
        isArray: true,
        required: false,
        description: 'The new set of actions performed on the devices for the scenario',
    })
    actions?: Array<ScenarioActionDto>;
}
