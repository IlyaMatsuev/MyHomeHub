export enum DeviceGatewayEvent {
    Pair = 'pair',
    State = 'state',
}

export interface DeviceGatewayResponseData {
    success: boolean;
    updateInterval: number;
}

export interface DeviceGatewayResponse {
    event: DeviceGatewayEvent;
    data: DeviceGatewayResponseData;
}
