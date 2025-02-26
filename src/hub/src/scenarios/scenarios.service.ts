import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Model } from 'mongoose';
import { GetScenariosOptions, Scenario, ScenarioCronTriggerSource, ScenarioFilter, ScenarioTriggerSourceType } from 'scenarios/interfaces';
import { CreateScenarioDto, UpdateScenarioDto } from 'scenarios/dto';
import { SCENARIO_MODEL_PROVIDER_NAME } from 'scenarios/scenarios.constants';
import { SchedulerService } from 'scheduler/scheduler.service';
import { ScenariosExecutionService } from 'scenarios/scenarios-execution.service';

@Injectable()
export class ScenariosService implements OnModuleInit {
    constructor(
        @Inject(SCENARIO_MODEL_PROVIDER_NAME)
        private readonly scenarioModel: Model<Scenario>,
        private readonly schedulerService: SchedulerService,
        private readonly scenariosExecutionService: ScenariosExecutionService,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.scheduleExistingScenarios();
    }

    getScenarios(): Promise<Array<Scenario>> {
        return this.scenarioModel.find().exec();
    }

    getScenarioByExternalId(externalId: string, options: GetScenariosOptions = { strict: true }): Promise<Scenario> {
        return this.getScenario({ externalId }, options);
    }

    async getScenario(filter: ScenarioFilter, options: GetScenariosOptions = { strict: true }): Promise<Scenario> {
        const scenario = await this.scenarioModel.findOne(filter).exec();
        if (!scenario && options.strict) {
            throw new NotFoundException('There is no scenario matching these criteria');
        }
        return scenario;
    }

    async addScenario(scenarioDto: CreateScenarioDto): Promise<Scenario> {
        const existingScenario = await this.getScenario({ name: scenarioDto.name }, { strict: false });
        if (existingScenario) {
            throw new BadRequestException(`Scenario with the same name ('${scenarioDto.name}') already exists`);
        }
        const newScenario = await new this.scenarioModel(scenarioDto).save({ validateBeforeSave: true });
        await this.scheduleScenarioJob(newScenario, () => this.removeScenario(newScenario.externalId));
        return newScenario;
    }

    async updateScenario(externalId: string, scenarioDto: UpdateScenarioDto): Promise<Scenario> {
        const scenario = await this.getScenarioByExternalId(externalId);
        const oldScenario = { ...scenario } as Scenario;
        scenario.name = scenarioDto.name ?? scenario.name;
        scenario.description = scenarioDto.description ?? scenario.description;
        scenario.trigger = scenarioDto.trigger ?? scenario.trigger;
        scenario.devices = scenarioDto.devices ?? scenario.devices;

        const updatedScenario = await scenario.save({ validateBeforeSave: true });
        if (scenarioDto.trigger?.sources && scenarioDto.trigger?.sources.some(s => s.type === ScenarioTriggerSourceType.Cron)) {
            this.schedulerService.unscheduleJob(updatedScenario.name);
            await this.scheduleScenarioJob(updatedScenario, async () => {
                await this.scenarioModel.findByIdAndUpdate(scenario._id, { ...oldScenario }, { runValidators: false }).exec();
                await this.scheduleScenarioJob(oldScenario, async () => {});
            });
        }
        return updatedScenario;
    }

    async removeScenario(externalId: string): Promise<Scenario> {
        const scenario = await this.getScenarioByExternalId(externalId);
        await this.scenarioModel.deleteOne({ _id: scenario._id }).exec();
        this.schedulerService.unscheduleJob(scenario.name);
        return scenario;
    }

    private async scheduleExistingScenarios(): Promise<void> {
        const scenarios = await this.getScenarios();
        for (const scenario of scenarios) {
            await this.scheduleScenarioJob(scenario, async () => {});
        }
    }

    private async scheduleScenarioJob(scenario: Scenario, onFailure: () => Promise<void | object>): Promise<void | never> {
        const cronTriggerSource = scenario.trigger.sources.find(
            s => s.type === ScenarioTriggerSourceType.Cron,
        ) as ScenarioCronTriggerSource;
        if (!cronTriggerSource) {
            return;
        }

        try {
            this.schedulerService.scheduleJob({
                name: scenario.name,
                cron: cronTriggerSource.cron,
                handler: () => this.scenariosExecutionService.execute(scenario.externalId, true),
            });
        } catch (ex) {
            await onFailure();
            throw new InternalServerErrorException(`Failed to schedule a scenario on "${cronTriggerSource.cron}: ${ex.message}"`);
        }
    }
}
