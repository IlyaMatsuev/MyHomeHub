import { Document } from 'mongodb';
import { RecordsPage } from 'common/interfaces';

export interface ScenarioGroup extends Document {
    name: string;
    scenariosCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export type ScenarioGroupFilter = Partial<ScenarioGroup & { _id: string }>;

export interface ScenarioGroupsPage extends RecordsPage {
    groups: Array<ScenarioGroup>;
}
