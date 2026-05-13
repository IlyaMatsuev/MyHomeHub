import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Model, RootFilterQuery } from 'mongoose';
import { Scenario, ScenarioGroup, ScenarioGroupsPage } from 'scenarios/interfaces';
import { GetScenarioGroupsDto } from 'scenarios/dto';
import { SCENARIO_GROUP_MODEL_PROVIDER_NAME, SCENARIO_MODEL_PROVIDER_NAME } from 'scenarios/scenarios.constants';

@Injectable()
export class ScenarioGroupsService {
    constructor(
        @Inject(SCENARIO_GROUP_MODEL_PROVIDER_NAME)
        private readonly scenarioGroupModel: Model<ScenarioGroup>,
        @Inject(SCENARIO_MODEL_PROVIDER_NAME)
        private readonly scenarioModel: Model<Scenario>,
    ) {}

    async getGroups(options: GetScenarioGroupsDto = new GetScenarioGroupsDto()): Promise<ScenarioGroupsPage> {
        const conditions: RootFilterQuery<ScenarioGroup> = {};
        if (options.term) {
            conditions.name = { $regex: options.term, $options: 'i' };
        }
        const [groups, total] = await Promise.all([
            this.scenarioGroupModel.find(conditions).sort({ name: 1 }).skip(options.skipRecords).limit(options.pageSize).lean(),
            this.scenarioGroupModel.countDocuments(conditions),
        ]);

        return {
            groups,
            page: options.page,
            pageSize: options.pageSize,
            totalPages: Math.ceil(total / options.pageSize),
        };
    }

    async getGroupByName(name: string): Promise<ScenarioGroup> {
        const group = await this.scenarioGroupModel.findOne({ name }).exec();
        if (!group) {
            throw new NotFoundException(`Scenario group '${name}' not found`);
        }
        return group;
    }

    async deleteGroup(name: string, deleteScenarios?: boolean): Promise<ScenarioGroup> {
        const group = await this.getGroupByName(name);

        if (group.scenariosCount > 0 && deleteScenarios === undefined) {
            throw new BadRequestException(
                `Cannot delete group '${group.name}' because there are ${group.scenariosCount} scenario(s) linked to this group. ` +
                    'Use deleteScenarios=true to delete the group and its scenarios, or deleteScenarios=false to clear the group from scenarios.',
            );
        }

        if (group.scenariosCount > 0) {
            if (deleteScenarios) {
                await this.scenarioModel.deleteMany({ group: group.name }).exec();
            } else {
                await this.scenarioModel.updateMany({ group: group.name }, { $unset: { group: 1 } }).exec();
            }
        }

        await this.scenarioGroupModel.deleteOne({ _id: group._id }).exec();
        return group;
    }

    async syncGroupOnCreate(groupName?: string): Promise<void> {
        if (!groupName) {
            return;
        }
        await this.upsertGroup(groupName, 1);
    }

    async syncGroupOnUpdate(oldGroupName?: string, newGroupName?: string): Promise<void> {
        if (oldGroupName === newGroupName) {
            return;
        }

        if (oldGroupName) {
            await this.decrementGroupCount(oldGroupName);
        }

        if (newGroupName) {
            await this.upsertGroup(newGroupName, 1);
        }
    }

    async syncGroupOnDelete(groupName?: string): Promise<void> {
        if (!groupName) {
            return;
        }
        await this.decrementGroupCount(groupName);
    }

    private async upsertGroup(groupName: string, incrementBy: number): Promise<void> {
        const existingGroup = await this.scenarioGroupModel.findOne({ name: groupName }).exec();
        if (existingGroup) {
            existingGroup.scenariosCount += incrementBy;
            await existingGroup.save();
        } else {
            const newGroup = new this.scenarioGroupModel({
                name: groupName,
                scenariosCount: incrementBy,
            });
            await newGroup.save();
        }
    }

    private async decrementGroupCount(groupName: string): Promise<void> {
        const group = await this.scenarioGroupModel.findOne({ name: groupName }).exec();
        if (group && group.scenariosCount > 0) {
            group.scenariosCount -= 1;
            await group.save();
        }
    }
}
