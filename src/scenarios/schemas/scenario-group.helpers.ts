import { Model } from 'mongoose';
import { ScenarioGroup } from 'scenarios/interfaces';

export async function getNextScenarioGroupId(model: Model<ScenarioGroup>): Promise<number> {
    const lastGroup = await model.findOne().sort({ id: -1 }).exec();
    return lastGroup ? lastGroup.id + 1 : 1;
}
