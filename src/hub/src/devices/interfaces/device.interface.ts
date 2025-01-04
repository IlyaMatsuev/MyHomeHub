import { Room } from './common';

export interface Device {
    id: string;
    name: string;
    room: Room;
    updateInterval: number;
    controls: Record<string, any>;
    measurements: Record<string, any>;
}
