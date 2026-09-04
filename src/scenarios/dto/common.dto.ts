import {
    ScenarioCronTriggerSource,
    ScenarioAction,
    ScenarioDeviceTriggerSource,
    ScenarioDeviceTriggerSourceConditions,
    ScenarioTrigger,
    ScenarioTriggerSource,
    ScenarioTriggerSourceType,
    ScenarioCronTimeAdjustOption,
} from 'scenarios/interfaces';
import { ApiExtraModels, ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';
import {
    ArrayNotEmpty,
    IsArray,
    IsDefined,
    IsNotEmpty,
    IsNotEmptyObject,
    IsObject,
    IsOptional,
    IsUUID,
    Length,
    ValidateNested,
} from 'class-validator';
import { EXTERNAL_ID_UUID_VERSION } from 'common/common.constants';
import { SCENARIO_TRIGGER_LOGIC_MAX_LENGTH, SCENARIO_TRIGGER_LOGIC_MIN_LENGTH } from 'scenarios/scenarios.constants';

@ApiSchema({ name: 'Scenarios.ScenarioCronTriggerSource' })
export class ScenarioCronTriggerSourceDto implements ScenarioCronTriggerSource {
    @ApiProperty({
        required: true,
        description: 'The type of the scenario trigger source',
        enum: ScenarioTriggerSourceType,
        example: ScenarioTriggerSourceType.Cron,
    })
    type: ScenarioTriggerSourceType.Cron;

    @ApiProperty({
        required: true,
        description: 'The CRON expression that will be used for triggering the scenario',
    })
    cron: string;

    @ApiProperty({
        required: false,
        description: 'Option to adjust the cron expression to a specific (dynamic) time of the day. E.g. sunset or sunrise time',
        enum: ScenarioCronTimeAdjustOption,
    })
    adjustTo?: ScenarioCronTimeAdjustOption;
}

@ApiSchema({ name: 'Scenarios.ScenarioDeviceTriggerSourceConditions' })
export class ScenarioDeviceTriggerSourceConditionsDto implements ScenarioDeviceTriggerSourceConditions {
    @ApiProperty({
        required: true,
        description: 'The set of conditions for triggering the scenario',
    })
    are: Record<string, object>;
}

@ApiExtraModels(ScenarioDeviceTriggerSourceConditionsDto)
@ApiSchema({ name: 'Scenarios.ScenarioDeviceTriggerSource' })
export class ScenarioDeviceTriggerSourceDto implements ScenarioDeviceTriggerSource {
    @ApiProperty({
        required: true,
        description: 'The type of the scenario trigger source',
        enum: ScenarioTriggerSourceType,
        example: ScenarioTriggerSourceType.Device,
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
            commands: {
                type: ScenarioDeviceTriggerSourceConditionsDto,
                required: false,
                description:
                    'The device commands conditions which trigger the scenario. Commands are not stored on the device, so the conditions are matched against the command that has just been executed - e.g. a button press of a remote',
                default: { are: {} },
            },
        },
        description: 'The triggering device details',
    })
    device: {
        externalId: string;
        controls?: ScenarioDeviceTriggerSourceConditionsDto;
        measurements?: ScenarioDeviceTriggerSourceConditionsDto;
        commands?: ScenarioDeviceTriggerSourceConditionsDto;
    };
}

@ApiExtraModels(ScenarioCronTriggerSourceDto, ScenarioDeviceTriggerSourceDto)
@ApiSchema({ name: 'Scenarios.ScenarioTrigger' })
export class ScenarioTriggerDto implements ScenarioTrigger {
    @IsDefined()
    @IsArray()
    @ArrayNotEmpty()
    @ApiProperty({
        type: 'array',
        items: {
            oneOf: [{ $ref: getSchemaPath(ScenarioCronTriggerSourceDto) }, { $ref: getSchemaPath(ScenarioDeviceTriggerSourceDto) }],
        },
        required: true,
        description: 'The list of trigger sources for the scenario',
    })
    sources: Array<ScenarioTriggerSource>;

    @IsNotEmpty()
    @Length(SCENARIO_TRIGGER_LOGIC_MIN_LENGTH, SCENARIO_TRIGGER_LOGIC_MAX_LENGTH)
    @ApiProperty({
        required: true,
        description: 'The boolean expression used to evaluate the scenario execution',
        example: '1 OR 2',
        minLength: SCENARIO_TRIGGER_LOGIC_MIN_LENGTH,
        maxLength: SCENARIO_TRIGGER_LOGIC_MAX_LENGTH,
    })
    logic: string;
}

@ApiSchema({ name: 'Scenarios.ScenarioActionSetting' })
export class ScenarioActionSettingDto {
    @IsOptional()
    @IsObject()
    @IsNotEmptyObject()
    @ApiProperty({
        required: false,
        description: 'The set of control fields to be set on the triggered device for the scenario',
        default: {},
    })
    controls?: Record<string, object>;

    @IsOptional()
    @IsObject()
    @IsNotEmptyObject()
    @ApiProperty({
        required: false,
        description: 'The set of measurements fields to be set on the triggered device for the scenario',
        default: {},
    })
    measurements?: Record<string, object>;
}

@ApiSchema({ name: 'Scenarios.ScenarioAction' })
export class ScenarioActionDto implements ScenarioAction {
    @IsNotEmpty()
    @IsUUID(EXTERNAL_ID_UUID_VERSION)
    @ApiProperty({
        required: true,
        description: 'The id of the device that needs to be changed on scenario execution',
    })
    externalId: string;

    @IsDefined()
    @ValidateNested()
    @ApiProperty({
        required: true,
        description: 'The set of device controls or measurements to be changed on scenario execution',
    })
    set: ScenarioActionSettingDto;
}
