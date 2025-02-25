import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ScenariosService } from 'scenarios/scenarios.service';
import { DevicesService } from 'devices/devices.service';
import { ConditionsEvaluatorService } from 'common/services/conditions-evaluator.service';
import { ScenarioDeviceTriggerSource, ScenarioTriggerSource, ScenarioTriggerSourceType } from 'scenarios/interfaces';

@Injectable()
export class ScenariosExecutionService {
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

            console.warn(`Executing job for scenario ${scenario.externalId}, ${new Date().toISOString()}`);
            console.warn(`Evaluating conditions: ${shouldExecuteScenario}`);
        } catch (error) {
            console.error(`Error during cron job execution for scenario: ${scenarioExternalId}`);
            console.error(error);
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
