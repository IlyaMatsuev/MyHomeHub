import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { PaginationDto } from 'common/dto';
import { Room } from 'devices/interfaces';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
    SCENARIO_GROUP_NAME_MAX_LENGTH,
    SCENARIO_GROUP_NAME_PATTERN,
    SCENARIO_GROUP_NAME_PATTERN_ERROR_MESSAGE,
} from 'scenarios/scenarios.constants';
import { IsBooleanValue } from 'common/decorators';

@ApiSchema({ name: 'Scenarios.GetScenarios', description: 'Parameters used to query scenarios' })
export class GetScenariosDto extends PaginationDto {
    @IsBooleanValue()
    @ApiProperty({
        required: false,
        default: false,
        description: 'Determines if the response should also include inactive scenarios',
    })
    includeInactive: boolean = false;

    @IsOptional()
    @IsString()
    @MaxLength(SCENARIO_GROUP_NAME_MAX_LENGTH)
    @Matches(SCENARIO_GROUP_NAME_PATTERN, { message: SCENARIO_GROUP_NAME_PATTERN_ERROR_MESSAGE })
    @ApiProperty({
        required: false,
        description: 'Filter scenarios by group name',
        maxLength: SCENARIO_GROUP_NAME_MAX_LENGTH,
    })
    group?: string;

    @IsOptional()
    @IsEnum(Room)
    @ApiProperty({
        required: false,
        description: 'Filter scenarios by the room of devices in the scenario devices array',
        enum: Room,
    })
    room?: Room;
}
