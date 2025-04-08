import {
    BadRequestException,
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { getSunrise, getSunset } from 'sunrise-sunset-js';
import {
    GetScenarioOptions,
    Scenario,
    ScenarioCronTimeAdjustOption,
    ScenarioCronTriggerSource,
    ScenarioFilter,
    ScenariosPage,
    ScenarioTriggerSourceType,
} from 'scenarios/interfaces';
import { CreateScenarioDto, GetScenariosDto, UpdateScenarioDto } from 'scenarios/dto';
import { DAY_TIME_ADJUSTMENT_JOB_CRON, SCENARIO_MODEL_PROVIDER_NAME, CRON_WITH_SECONDS_LENGTH } from 'scenarios/scenarios.constants';
import { SchedulerService } from 'scheduler/scheduler.service';
import { ScenariosExecutionService } from 'scenarios/scenarios-execution.service';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ScenariosService implements OnModuleInit {
    private readonly logger = new Logger(ScenariosService.name);

    constructor(
        @Inject(SCENARIO_MODEL_PROVIDER_NAME)
        private readonly scenarioModel: Model<Scenario>,
        private readonly schedulerService: SchedulerService,
        private readonly scenariosExecutionService: ScenariosExecutionService,
        private readonly configService: ConfigService,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.scheduleExistingScenarios();
    }

    async getScenarios(options: GetScenariosDto = new GetScenariosDto()): Promise<ScenariosPage> {
        const [scenarios, total] = await Promise.all([
            this.scenarioModel.find().skip(options.skipRecords).limit(options.pageSize).lean(),
            this.scenarioModel.countDocuments(),
        ]);

        return {
            scenarios,
            page: options.page,
            pageSize: options.pageSize,
            totalPages: Math.ceil(total / options.pageSize),
        };
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
        const scenarios = await this.scenarioModel.find().exec();
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

    @Cron(DAY_TIME_ADJUSTMENT_JOB_CRON)
    private async handleDayTimeAdjustments() {
        this.logger.log('Recalculating scenarios day-time adjustments');
        try {
            const latitude = this.configService.get<number>('TZ_LATITUDE');
            const longitude = this.configService.get<number>('TZ_LONGITUDE');
            const sunriseTime = getSunrise(latitude, longitude);
            const sunsetTime = getSunset(latitude, longitude);

            this.logger.debug(`Sunrise time: ${sunriseTime}`);
            this.logger.debug(`Sunset time: ${sunsetTime}`);

            const scenariosWithDayTimeAdjustments = await this.scenarioModel
                .find({
                    'trigger.sources': {
                        $elemMatch: {
                            type: ScenarioTriggerSourceType.Cron,
                            adjustTo: { $exists: true },
                        },
                    },
                })
                .exec();

            for (const scenario of scenariosWithDayTimeAdjustments) {
                const trigger = {
                    ...scenario.trigger,
                    sources: scenario.trigger.sources.map(source => {
                        if (source.type === ScenarioTriggerSourceType.Cron) {
                            const cronSource = source as ScenarioCronTriggerSource;
                            if (cronSource.adjustTo === ScenarioCronTimeAdjustOption.Sunrise) {
                                cronSource.cron = this.updateCronTime(cronSource.cron, sunriseTime);
                            } else if (cronSource.adjustTo === ScenarioCronTimeAdjustOption.Sunset) {
                                cronSource.cron = this.updateCronTime(cronSource.cron, sunsetTime);
                            }
                        }
                        return source;
                    }),
                };
                await this.updateScenario(scenario.externalId, { trigger });
            }
        } catch (error) {
            this.logger.error(`Failed to adjust day time of the scenarios: ${error}`);
        }
    }

    private updateCronTime(cron: string, dateTime: Date): string {
        const hours = dateTime.getHours().toString();
        const minutes = dateTime.getMinutes().toString();

        const cronParts = cron.split(' ');
        if (cronParts.length === CRON_WITH_SECONDS_LENGTH) {
            cronParts.shift();
        }
        cronParts.shift();
        cronParts.shift();
        return [minutes, hours, ...cronParts].join(' ');
    }
}
