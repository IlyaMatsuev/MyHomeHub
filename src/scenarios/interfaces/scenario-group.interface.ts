import { Document } from 'mongodb';

export interface ScenarioGroup extends Document {
    id: number;
    name: string;
    scenariosCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export type ScenarioGroupFilter = Partial<ScenarioGroup & { _id: string }>;
