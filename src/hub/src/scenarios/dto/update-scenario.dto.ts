import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { ScenarioDeviceDto, ScenarioTriggerDto } from 'scenarios/dto/common.dto';

@ApiSchema({ name: 'UpdateScenarioRequest', description: 'DTO used to update an existing scenario information or devices' })
export class UpdateScenarioDto {
    @ApiProperty({
        required: false,
        description: 'The new name for the scenario',
        minLength: 3,
        maxLength: 80,
    })
    name?: string;

    @ApiProperty({
        required: false,
        description: 'The new description for the scenario',
        minLength: 5,
        maxLength: 255,
    })
    description?: string;

    @ApiProperty({
        required: false,
        description: 'The new trigger setup for the scenario',
    })
    trigger?: ScenarioTriggerDto;

    @ApiProperty({
        type: ScenarioDeviceDto,
        isArray: true,
        required: false,
        description: 'The new set of triggered devices for the scenario',
    })
    devices?: Array<ScenarioDeviceDto>;
}
