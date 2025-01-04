export enum Room {
    LivingRoom = 'living-room'
}

export interface Device {
    id: string;
    name: string;
    room: Room;
    updateInterval: number;
    controls: Record<string, any>;
    measurements: Record<string, any>;
}
