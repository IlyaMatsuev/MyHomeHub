import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConditionsEvaluatorService } from 'common/services/conditions-evaluator.service';
import { UpdateDeviceDto } from 'devices/dto';
import { DeviceControlsUpdatedEvent, DeviceMeasurementsUpdatedEvent } from 'devices/events';
import { DevicesService } from 'devices/devices.service';
import { Scenario, ScenarioDeviceTriggerSource, ScenarioTriggerSource, ScenarioTriggerSourceType } from 'scenarios/interfaces';
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
    ) {}

    async execute(scenarioExternalId: string, wasScheduled: boolean): Promise<void> {
        let scenario: Scenario;
        try {
            scenario = await this.scenariosService.getScenarioByExternalId(scenarioExternalId);
            const conditions = await this.extractConditions(scenario.trigger.sources, wasScheduled);
            const shouldExecuteScenario = this.conditionsEvaluatorService.evaluateTriggerExpression(scenario.trigger.logic, conditions);

            this.logger.debug(`Executing scenario ${scenario.externalId}. Conditions met: ${shouldExecuteScenario}`);

            if (shouldExecuteScenario) {
                await this.executeScenario(scenario);
            }
        } catch (error) {
            this.logger.error(`Error during cron job execution for scenario: ${scenarioExternalId}`);
            this.logger.error(error);
        } finally {
        }
    }

    @OnEvent(DeviceControlsUpdatedEvent.eventName)
    private async onDeviceControlsUpdated(event: DeviceControlsUpdatedEvent): Promise<void> {
        const device = await this.devicesService.getDeviceByExternalId(event.deviceExternalId);
        await this.devicesService.getControlService(device).setControls(event.controls);
        return this.triggerDeviceRelatedScenarios(event.deviceExternalId);
    }

    @OnEvent(DeviceMeasurementsUpdatedEvent.eventName)
    private async onDeviceMeasurementsUpdated(event: DeviceMeasurementsUpdatedEvent): Promise<void> {
        return this.triggerDeviceRelatedScenarios(event.deviceExternalId);
    }

    private async extractConditions(triggerSources: Array<ScenarioTriggerSource>, wasScheduled: boolean): Promise<Array<boolean>> {
        const conditions: Array<boolean> = [];
        for (const source of triggerSources) {
            if (source.type === ScenarioTriggerSourceType.Cron) {
                conditions.push(wasScheduled);
            }
            if (source.type === ScenarioTriggerSourceType.Device) {
                const deviceSource = source as ScenarioDeviceTriggerSource;
                const device = await this.devicesService.getDeviceByExternalId(deviceSource.device.externalId);
                conditions.push(this.conditionsEvaluatorService.deviceConditionIsMet(deviceSource, device));
            }
        }
        return conditions;
    }

    private async triggerDeviceRelatedScenarios(deviceExternalId: string): Promise<void> {
        this.logger.debug(`Received controls/measurements update for a device "${deviceExternalId}"`);
        const triggeredScenarios = await this.scenariosService.getDeviceTriggeredScenarios(deviceExternalId);

        this.logger.debug(`Triggered scenarios: "${triggeredScenarios.length}"`);

        for (const triggeredScenario of triggeredScenarios) {
            await this.execute(triggeredScenario.externalId, false);
        }
    }

    private async executeScenario(scenario: Scenario): Promise<void> {
        for (const deviceAction of scenario.devices) {
            if (deviceAction.set.controls) {
                const device = await this.devicesService.getDeviceByExternalId(deviceAction.externalId);
                await this.devicesService.updateDevice(device.externalId, new UpdateDeviceDto({ controls: deviceAction.set.controls }));
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
