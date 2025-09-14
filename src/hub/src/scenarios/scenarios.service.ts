import {
    BadRequestException,
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { Model, RootFilterQuery } from 'mongoose';
import {
    GetScenarioOptions,
    Scenario,
    ScenarioCronTriggerSource,
    ScenarioFilter,
    ScenariosPage,
    ScenarioTriggerSourceType,
} from 'scenarios/interfaces';
import { CreateScenarioDto, GetScenariosDto, UpdateScenarioDto } from 'scenarios/dto';
import { SCENARIO_MODEL_PROVIDER_NAME } from 'scenarios/scenarios.constants';
import { SchedulerService } from 'scheduler/scheduler.service';
import { ScenariosExecutionService } from 'scenarios/scenarios-execution.service';

@Injectable()
export class ScenariosService implements OnModuleInit {
    private readonly logger = new Logger(ScenariosService.name);

    constructor(
        @Inject(SCENARIO_MODEL_PROVIDER_NAME)
        private readonly scenarioModel: Model<Scenario>,
        private readonly schedulerService: SchedulerService,
        private readonly scenariosExecutionService: ScenariosExecutionService,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.scheduleExistingScenarios();
    }

    async getScenarios(options: GetScenariosDto = new GetScenariosDto()): Promise<ScenariosPage> {
        const conditions: RootFilterQuery<Scenario> = options.includeInactive ? {} : { active: true };
        const [scenarios, total] = await Promise.all([
            this.scenarioModel.find(conditions).skip(options.skipRecords).limit(options.pageSize).lean(),
            this.scenarioModel.countDocuments(conditions),
        ]);

        return {
            scenarios,
            page: options.page,
            pageSize: options.pageSize,
            totalPages: Math.ceil(total / options.pageSize),
        };
    }

    getScenariosWithAdjustableTime(): Promise<Array<Scenario>> {
        return this.scenarioModel
            .find({
                'trigger.sources': {
                    $elemMatch: {
                        type: ScenarioTriggerSourceType.Cron,
                        adjustTo: { $exists: true },
                    },
                },
            })
            .exec();
    }

    getDeviceTriggeredScenarios(deviceExternalId: string): Promise<Array<Scenario>> {
        return this.scenarioModel
            .find({
                active: true,
                'trigger.sources': {
                    $elemMatch: {
                        type: 'device',
                        'device.externalId': deviceExternalId,
                    },
                },
            })
            .exec();
    }

    getScenarioByExternalId(externalId: string, options: GetScenarioOptions = { strict: true }): Promise<Scenario> {
        return this.getScenario({ externalId }, options);
    }

    async getScenario(filter: ScenarioFilter, options: GetScenarioOptions = { strict: true }): Promise<Scenario> {
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
        const cronSource = this.findScenarioCronSource(scenarioDto);
        if (cronSource && cronSource.adjustTo) {
            cronSource.cron = this.schedulerService.adjustScenarioDayTimeCron(cronSource);
        }
        const newScenario: Scenario = await new this.scenarioModel(scenarioDto).save({ validateBeforeSave: true });
        if (newScenario.active) {
            await this.scheduleScenarioJob(newScenario, () => this.removeScenario(newScenario.externalId));
        }
        return newScenario;
    }

    async updateScenario(externalId: string, scenarioDto: UpdateScenarioDto): Promise<Scenario> {
        const scenario = await this.getScenarioByExternalId(externalId);
        const oldScenario: Scenario = scenario.toObject();

        scenario.name = scenarioDto.name ?? scenario.name;
        scenario.description = scenarioDto.description ?? scenario.description;
        scenario.active = scenarioDto.active ?? scenario.active;
        scenario.repeatTimes = scenarioDto.repeatTimes ?? scenario.repeatTimes;
        scenario.trigger = scenarioDto.trigger ?? scenario.trigger;
        scenario.devices = scenarioDto.devices ?? scenario.devices;

        const cronSource = this.findScenarioCronSource(scenario);
        if (cronSource && cronSource.adjustTo && scenarioDto.trigger) {
            cronSource.cron = this.schedulerService.adjustScenarioDayTimeCron(cronSource);
        }

        this.logger.debug(`scenario: ${JSON.stringify(scenario)}`);

        const updatedScenario = await scenario.save({ validateBeforeSave: true });
        this.logger.debug(`updatedScenario: ${updatedScenario.trigger?.sources}, ${JSON.stringify(updatedScenario)}`);
        this.logger.debug(`oldScenario: ${oldScenario.trigger?.sources}, ${JSON.stringify(oldScenario)}`);

        if (this.isCronScenario(oldScenario) && oldScenario.active) {
            this.schedulerService.unscheduleJob(oldScenario.name);
        }
        this.logger.debug(`After isCronScenario(oldScenario)`);
        if (this.isCronScenario(updatedScenario) && updatedScenario.active) {
            this.logger.debug(`After isCronScenario(updatedScenario)`);
            await this.scheduleScenarioJob(updatedScenario, async () => {
                this.logger.debug(`After scheduleScenarioJob failed`);
                await this.scenarioModel.findByIdAndUpdate(scenario._id, { ...oldScenario }, { runValidators: false }).exec();
                await this.scheduleScenarioJob(oldScenario, async () => {});
                this.logger.debug(`After scheduleScenarioJob failed 2`);
            });
        }
        return updatedScenario;
    }

    async removeScenario(externalId: string): Promise<Scenario> {
        const scenario = await this.getScenarioByExternalId(externalId);
        await this.scenarioModel.deleteOne({ _id: scenario._id }).exec();
        if (scenario.active) {
            this.schedulerService.unscheduleJob(scenario.name);
        }
        return scenario;
    }

    private async scheduleExistingScenarios(): Promise<void> {
        const scenarios = await this.scenarioModel.find({ active: true }).exec();
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
            this.logger.error(`Failed to schedule a scenario on "${cronTriggerSource.cron}: ${ex.message}"`);
            await onFailure();
            throw new InternalServerErrorException(`Failed to schedule a scenario on "${cronTriggerSource.cron}: ${ex.message}"`);
        }
    }

    private isCronScenario(scenario: Scenario): boolean {
        return scenario.trigger?.sources && scenario.trigger.sources.some(s => s.type === ScenarioTriggerSourceType.Cron);
    }

    private findScenarioCronSource(scenario: Scenario | CreateScenarioDto): ScenarioCronTriggerSource | undefined {
        return scenario.trigger.sources.find(s => s.type === ScenarioTriggerSourceType.Cron) as ScenarioCronTriggerSource;
    }
}
