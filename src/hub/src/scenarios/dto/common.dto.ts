import {
    ScenarioCronTriggerSource,
    ScenarioDevice,
    ScenarioDeviceTriggerSource,
    ScenarioDeviceTriggerSourceConditions,
    ScenarioTrigger,
    ScenarioTriggerSource,
    ScenarioTriggerSourceType,
} from 'scenarios/interfaces';
import { ApiExtraModels, ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

@ApiSchema({ name: 'ScenarioCronTriggerSource' })
export class ScenarioCronTriggerSourceDto implements ScenarioCronTriggerSource {
    @ApiProperty({
        required: true,
        description: 'The type of the scenario trigger source',
        enum: ScenarioTriggerSourceType,
    })
    type: ScenarioTriggerSourceType.Cron;

    @ApiProperty({
        required: true,
        description: 'The CRON expression that will be used for triggering the scenario',
    })
    cron: string;
}

@ApiSchema({ name: 'ScenarioDeviceTriggerSourceConditions' })
export class ScenarioDeviceTriggerSourceConditionsDto implements ScenarioDeviceTriggerSourceConditions {
    @ApiProperty({
        required: true,
        description: 'The set of conditions for triggering the scenario',
    })
    are: Record<string, object>;
}

@ApiExtraModels(ScenarioDeviceTriggerSourceConditionsDto)
@ApiSchema({ name: 'ScenarioDeviceTriggerSource' })
export class ScenarioDeviceTriggerSourceDto implements ScenarioDeviceTriggerSource {
    @ApiProperty({
        required: true,
        description: 'The type of the scenario trigger source',
        enum: ScenarioTriggerSourceType,
    })
    type: ScenarioTriggerSourceType.Device;

    @ApiProperty({
        type: 'object',
        properties: {
            externalId: { required: true, description: 'The id of the triggering device' },
            controls: {
                type: ScenarioDeviceTriggerSourceConditionsDto,
                required: false,
                description: 'The device control conditions which trigger the scenario',
                default: { are: {} },
            },
            measurements: {
                type: ScenarioDeviceTriggerSourceConditionsDto,
                required: false,
                description: 'The device measurements conditions which trigger the scenario',
                default: { are: {} },
            },
        },
        description: 'The triggering device details',
    })
    device: {
        externalId: string;
        controls?: ScenarioDeviceTriggerSourceConditionsDto;
        measurements?: ScenarioDeviceTriggerSourceConditionsDto;
    };
}

@ApiExtraModels(ScenarioCronTriggerSourceDto, ScenarioDeviceTriggerSourceDto)
@ApiSchema({ name: 'ScenarioTrigger' })
export class ScenarioTriggerDto implements ScenarioTrigger {
    @ApiProperty({
        type: 'array',
        items: {
            oneOf: [{ $ref: getSchemaPath(ScenarioCronTriggerSourceDto) }, { $ref: getSchemaPath(ScenarioDeviceTriggerSourceDto) }],
        },
        required: true,
        description: 'The list of trigger sources for the scenario',
    })
    sources: Array<ScenarioTriggerSource>;

    @ApiProperty({
        required: true,
        description: 'The boolean expression used to evaluate the scenario execution',
        example: '1 OR 2',
        maxLength: 80,
    })
    logic: string;
}

@ApiSchema({ name: 'ScenarioDeviceSetting' })
export class ScenarioDeviceSettingDto {
    @ApiProperty({
        required: false,
        description: 'The set of control fields to be set on the triggered device for the scenario',
        default: {},
    })
    controls?: Record<string, object>;

    @ApiProperty({
        required: false,
        description: 'The set of measurements fields to be set on the triggered device for the scenario',
        default: {},
    })
    measurements?: Record<string, object>;
}

@ApiSchema({ name: 'ScenarioDevice' })
export class ScenarioDeviceDto implements ScenarioDevice {
    @ApiProperty({
        required: true,
        description: 'The id of the device that needs to be changed on scenario execution',
    })
    externalId: string;

    @ApiProperty({
        required: true,
        description: 'The set of device controls or measurements to be changed on scenario execution',
    })
    set: ScenarioDeviceSettingDto;
}
