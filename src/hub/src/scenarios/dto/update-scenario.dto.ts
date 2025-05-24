import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { ScenarioDeviceDto, ScenarioTriggerDto } from 'scenarios/dto/common.dto';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import {
    SCENARIO_DESCRIPTION_MAX_LENGTH,
    SCENARIO_DESCRIPTION_MIN_LENGTH,
    SCENARIO_NAME_MAX_LENGTH,
    SCENARIO_NAME_MIN_LENGTH,
} from 'scenarios/scenarios.constants';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'UpdateScenarioRequest', description: 'DTO used to update an existing scenario information or devices' })
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
    @ValidateNested({ each: true })
    @ApiProperty({
        required: false,
        description: 'The new trigger setup for the scenario',
    })
    trigger?: ScenarioTriggerDto;

    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => ScenarioDeviceDto)
    @ApiProperty({
        type: ScenarioDeviceDto,
        isArray: true,
        required: false,
        description: 'The new set of triggered devices for the scenario',
    })
    devices?: Array<ScenarioDeviceDto>;
}
