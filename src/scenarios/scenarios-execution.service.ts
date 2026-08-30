import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConditionsEvaluatorService, DeviceConditionContext } from 'common/services';
import { UpdateDeviceDto } from 'devices/dto';
import { DevicePayload } from 'devices/interfaces';
import { DeviceUpdateCompletedEvent, DeviceCommandExecutedEvent, DeviceUpdateRequestedEvent } from 'devices/events';
import { DevicesService } from 'devices/devices.service';
import { DEVICE_CONFIG_SECTIONS } from 'device-configs/interfaces';
import {
    Scenario,
    ScenarioDeviceConditionSection,
    ScenarioDeviceTriggerSource,
    ScenarioExecutionContext,
    ScenarioTriggerSource,
    ScenarioTriggerSourceType,
} from 'scenarios/interfaces';
import { ScenariosService } from 'scenarios/scenarios.service';
import { UpdateScenarioDto } from 'scenarios/dto';

@Injectable()
export class ScenariosExecutionService {
    private readonly logger = new Logger(ScenariosExecutionService.name);

    constructor(
        @Inject(forwardRef(() => ScenariosService))
        private readonly scenariosService: ScenariosService,
        private readonly devicesService: DevicesService,
        private readonly conditionsEvaluatorService: ConditionsEvaluatorService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    @OnEvent(DeviceUpdateCompletedEvent.eventName)
    async onDeviceUpdateCompleted(event: DeviceUpdateCompletedEvent): Promise<void> {
        if (event.controlsUpdated || event.measurementsUpdated) {
            await this.triggerDeviceRelatedScenarios(event.deviceExternalId);
        }
    }

    @OnEvent(DeviceCommandExecutedEvent.eventName)
    async onDeviceCommandExecuted(event: DeviceCommandExecutedEvent): Promise<void> {
        await this.triggerDeviceRelatedScenarios(event.deviceExternalId, { commands: event.commands });
    }

    async execute(scenario: Scenario, context: ScenarioExecutionContext): Promise<void> {
        try {
            const conditions = await this.extractConditions(scenario.trigger.sources, context);
            const shouldExecuteScenario = this.conditionsEvaluatorService.evaluateTriggerExpression(scenario.trigger.logic, conditions);

            this.logger.debug(`Executing scenario ${scenario.externalId}. Conditions met: ${shouldExecuteScenario}`);

            if (shouldExecuteScenario) {
                await this.executeScenario(scenario);
            }
        } catch (error) {
            this.logger.error(`Error during cron job execution for scenario: ${scenario.externalId}`);
            this.logger.error(error);
        } finally {
        }
    }

    private async triggerDeviceRelatedScenarios(deviceExternalId: string, context: ScenarioExecutionContext = {}): Promise<void> {
        this.logger.debug(`Received controls/measurements update for a device "${deviceExternalId}"`);
        const triggeredScenarios = await this.scenariosService.getDeviceTriggeredScenarios(deviceExternalId);

        this.logger.debug(`Triggered scenarios: "${triggeredScenarios.length}"`);

        for (const triggeredScenario of triggeredScenarios) {
            await this.execute(triggeredScenario, context);
        }
    }

    private async extractConditions(
        triggerSources: Array<ScenarioTriggerSource>,
        context: ScenarioExecutionContext,
    ): Promise<Array<boolean>> {
        const conditions: Array<boolean> = [];
        for (const source of triggerSources) {
            if (source.type === ScenarioTriggerSourceType.Cron) {
                conditions.push(context.scheduled ?? false);
            }
            if (source.type === ScenarioTriggerSourceType.Device) {
                const deviceSource = source as ScenarioDeviceTriggerSource;
                const device = await this.devicesService.getDeviceByExternalId(deviceSource.device.externalId);
                const deviceContext: DeviceConditionContext = { device, commands: context.commands };
                const conditionIsMet = this.conditionsEvaluatorService.deviceConditionIsMet(deviceSource, deviceContext);
                if (!conditionIsMet) {
                    this.logger.debug(this.formatUnmetDeviceCondition(deviceSource, deviceContext));
                }
                conditions.push(conditionIsMet);
            }
        }
        return conditions;
    }

    /**
     * Explains which section of a device trigger source did not match, so that a scenario that never runs
     * can be told apart from a scenario whose conditions are simply not satisfied yet
     */
    private formatUnmetDeviceCondition(source: ScenarioDeviceTriggerSource, context: DeviceConditionContext): string {
        const actualPayloads: Record<ScenarioDeviceConditionSection, DevicePayload> = {
            controls: context.device?.controls,
            measurements: context.device?.measurements,
            commands: context.commands,
        };
        const details = DEVICE_CONFIG_SECTIONS.filter(section => source.device[section]?.are)
            .map(
                section =>
                    `${section}: expected ${JSON.stringify(source.device[section].are)}, got ${JSON.stringify(actualPayloads[section] ?? null)}`,
            )
            .join('; ');
        return `Device trigger source "${source.device.externalId}" is not met - ${details}`;
    }

    private async executeScenario(scenario: Scenario): Promise<void> {
        for (const action of scenario.actions) {
            if (action.set.controls) {
                this.eventEmitter.emit(
                    DeviceUpdateRequestedEvent.eventName,
                    new DeviceUpdateRequestedEvent(
                        { externalId: action.externalId },
                        new UpdateDeviceDto({ controls: action.set.controls }),
                    ),
                );
            }
        }

        if (Number.isInteger(scenario?.repeatTimes)) {
            await this.updateScenarioRepeatTimes(scenario);
        }
    }

    private async updateScenarioRepeatTimes(scenario: Scenario): Promise<void> {
        let payload: UpdateScenarioDto;
        const executionsLeft = scenario.repeatTimes - 1;
        if (executionsLeft === 0) {
            payload = { active: false, repeatTimes: null };
        } else {
            payload = { repeatTimes: executionsLeft };
        }
        await this.scenariosService.updateScenario(scenario.externalId, payload);
    }
}
