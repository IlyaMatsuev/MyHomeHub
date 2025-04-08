import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConditionsEvaluatorService } from 'common/services/conditions-evaluator.service';
import { ScenarioDeviceTriggerSource, ScenarioTriggerSource, ScenarioTriggerSourceType } from 'scenarios/interfaces';
import { ScenariosService } from 'scenarios/scenarios.service';
import { DevicesService } from 'devices/devices.service';
import { DeviceUpdatedEvent } from 'devices/events';

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
        try {
            const scenario = await this.scenariosService.getScenarioByExternalId(scenarioExternalId);
            const conditions = await this.extractConditions(scenario.trigger.sources, wasScheduled);
            const shouldExecuteScenario = this.conditionsEvaluatorService.evaluateTriggerExpression(scenario.trigger.logic, conditions);

            this.logger.debug(`Executing scenario ${scenario.externalId}. Conditions met: ${shouldExecuteScenario}`);

            if (shouldExecuteScenario) {
                for (const deviceAction of scenario.devices) {
                    const device = await this.devicesService.getDeviceByExternalId(deviceAction.externalId);
                    if (deviceAction.set.controls) {
                        await this.devicesService.updateDevice(device.externalId, { controls: deviceAction.set.controls });
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Error during cron job execution for scenario: ${scenarioExternalId}`);
            this.logger.error(error);
        }
    }

    @OnEvent(DeviceUpdatedEvent.eventName)
    private async onDeviceUpdated(event: DeviceUpdatedEvent) {
        const device = await this.devicesService.getDeviceByExternalId(event.deviceExternalId);
        if (event.controlsUpdated) {
            const controlService = this.devicesService.getControlService(device);
            await controlService.setControls(event.update.controls);
        }

        if (event.controlsUpdated || event.measurementsUpdated) {
            this.logger.debug(`Received controls/measurements update for a device "${event.deviceExternalId}"`);
            const triggeredScenarios = await this.scenariosService.getDeviceTriggeredScenarios(device.externalId);

            this.logger.debug(`Triggered scenarios: "${triggeredScenarios.length}"`);

            for (const triggeredScenario of triggeredScenarios) {
                await this.execute(triggeredScenario.externalId, false);
            }
        }
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
}
