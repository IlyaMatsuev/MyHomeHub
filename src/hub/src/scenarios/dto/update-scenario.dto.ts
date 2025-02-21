import { ApiSchema } from '@nestjs/swagger';
import { ScenarioDeviceDto, ScenarioTriggerDto } from 'scenarios/dto/common.dto';

@ApiSchema({ name: 'UpdateScenarioRequest', description: 'DTO used to update an existing scenario information or devices' })
export class UpdateScenarioDto {
    name?: string;

    description?: string;

    trigger?: ScenarioTriggerDto;

    devices?: Array<ScenarioDeviceDto>;
}
