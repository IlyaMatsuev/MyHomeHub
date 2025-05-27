import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConditionsEvaluatorService } from 'common/services/conditions-evaluator.service';
import { ScenarioDeviceTriggerSource, ScenarioTriggerSource, ScenarioTriggerSourceType } from 'scenarios/interfaces';
import { ScenariosService } from 'scenarios/scenarios.service';
import { DevicesService } from 'devices/devices.service';
import { DeviceControlsUpdatedEvent, DeviceMeasurementsUpdatedEvent } from 'devices/events';
import { UpdateDeviceDto } from 'devices/dto';

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
                    if (deviceAction.set.controls) {
                        const device = await this.devicesService.getDeviceByExternalId(deviceAction.externalId);
                        await this.devicesService.updateDevice(
                            device.externalId,
                            new UpdateDeviceDto({ controls: deviceAction.set.controls }),
                        );
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Error during cron job execution for scenario: ${scenarioExternalId}`);
            this.logger.error(error);
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
}
