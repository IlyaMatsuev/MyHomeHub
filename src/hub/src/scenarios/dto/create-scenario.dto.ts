import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { ScenarioDeviceDto, ScenarioTriggerDto } from 'scenarios/dto/common.dto';
import {
    SCENARIO_DESCRIPTION_MAX_LENGTH,
    SCENARIO_DESCRIPTION_MIN_LENGTH,
    SCENARIO_MINIMUM_REPEAT_TIMES,
    SCENARIO_NAME_MAX_LENGTH,
    SCENARIO_NAME_MIN_LENGTH,
} from 'scenarios/scenarios.constants';
import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsDefined,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'CreateScenarioRequest', description: 'DTO used to add a new scenario to the hub control' })
export class CreateScenarioDto {
    @IsString()
    @IsNotEmpty()
    @Length(SCENARIO_NAME_MIN_LENGTH, SCENARIO_NAME_MAX_LENGTH)
    @ApiProperty({
        required: true,
        description: 'The name for the scenario',
        minLength: SCENARIO_NAME_MIN_LENGTH,
        maxLength: SCENARIO_NAME_MAX_LENGTH,
    })
    name: string;

    @IsOptional()
    @IsString()
    @Length(SCENARIO_DESCRIPTION_MIN_LENGTH, SCENARIO_DESCRIPTION_MAX_LENGTH)
    @ApiProperty({
        required: false,
        description: 'The description for the scenario',
        minLength: SCENARIO_DESCRIPTION_MIN_LENGTH,
        maxLength: SCENARIO_DESCRIPTION_MAX_LENGTH,
    })
    description?: string;

    @IsOptional()
    @IsBoolean()
    @ApiProperty({
        required: false,
        default: true,
        description: 'Determines if the scenario should be actively executed',
    })
    active: boolean = true;

    @IsOptional()
    @IsInt()
    @Min(SCENARIO_MINIMUM_REPEAT_TIMES)
    @ApiProperty({
        required: false,
        description:
            'Determines the number of times the scenario needs to be executed. If not provided, repeat infinitely. Each scenario execution subtracts this value by one. After the last execution, the scenario becomes inactive and the field is set blank',
    })
    repeatTimes?: number;

    @IsDefined()
    @ValidateNested()
    @ApiProperty({
        required: true,
        description: 'The trigger setup for the scenario',
    })
    trigger: ScenarioTriggerDto;

    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => ScenarioDeviceDto)
    @ApiProperty({
        type: ScenarioDeviceDto,
        isArray: true,
        required: true,
        description: 'The set of triggered devices for the scenario',
    })
    devices: Array<ScenarioDeviceDto>;
}
