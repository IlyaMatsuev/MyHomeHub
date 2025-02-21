import { ApiSchema } from '@nestjs/swagger';
import { ScenarioDeviceDto, ScenarioTriggerDto } from 'scenarios/dto/common.dto';

// TODO: Add swagger support

@ApiSchema({ name: 'CreateScenarioRequest', description: 'DTO used to add a new scenario to the hub control' })
export class CreateScenarioDto {
    name: string;

    description?: string;

    trigger: ScenarioTriggerDto;

    devices: Array<ScenarioDeviceDto>;
}
