import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { ScenarioDeviceDto, ScenarioTriggerDto } from 'scenarios/dto/common.dto';

@ApiSchema({ name: 'CreateScenarioRequest', description: 'DTO used to add a new scenario to the hub control' })
export class CreateScenarioDto {
    @ApiProperty({
        required: true,
        description: 'The name for the scenario',
        minLength: 3,
        maxLength: 80,
    })
    name: string;

    @ApiProperty({
        required: false,
        description: 'The description for the scenario',
        minLength: 5,
        maxLength: 255,
    })
    description?: string;

    @ApiProperty({
        required: true,
        description: 'The trigger setup for the scenario',
    })
    trigger: ScenarioTriggerDto;

    @ApiProperty({
        type: ScenarioDeviceDto,
        isArray: true,
        required: true,
        description: 'The set of triggered devices for the scenario',
    })
    devices: Array<ScenarioDeviceDto>;
}
