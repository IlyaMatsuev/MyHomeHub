import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { GetScenariosOptions, Scenario, ScenarioFilter } from 'scenarios/interfaces';
import { CreateScenarioDto, UpdateScenarioDto } from 'scenarios/dto';
import { SCENARIO_MODEL_PROVIDER_NAME } from 'scenarios/scenarios.constants';

@Injectable()
export class ScenariosService {
    constructor(
        @Inject(SCENARIO_MODEL_PROVIDER_NAME)
        private readonly scenarioModel: Model<Scenario>,
    ) {}

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
        return new this.scenarioModel(scenarioDto).save({ validateBeforeSave: true });
    }

    async updateScenario(externalId: string, scenarioDto: UpdateScenarioDto): Promise<Scenario> {
        const scenario = await this.getScenarioByExternalId(externalId);
        return this.scenarioModel.findByIdAndUpdate(scenario._id, { ...scenarioDto }, { new: true, runValidators: true }).exec();
    }

    async removeScenario(externalId: string): Promise<Scenario> {
        const scenario = await this.getScenarioByExternalId(externalId);
        await this.scenarioModel.deleteOne({ _id: scenario._id }).exec();
        return scenario;
    }
}
