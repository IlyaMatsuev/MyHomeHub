export enum TransportProtocol {
    Mqtt = 'mqtt',
    Http = 'http',
    // Tuya uses http, but I'm using external library, so transport logic if not a pure HTTP request
    Tuya = 'tuya',
    Zigbee = 'zigbee',
}

export interface MqttMessage {
    topic: string;
    topicParams?: Array<string>;
    payload?: Record<string, unknown>;
}

export interface HttpMessage {
    method: 'GET' | 'POST';
    url: string;
    payload?: Record<string, unknown>;
}

export interface TuyaMessage {
    tuyaId: string;
    ip: string;
    localKey: string;
    payload: TuyaDeviceControls;
}
export type TuyaDeviceControls = { [key: number]: boolean | string | number };

export interface ZigbeeMessage {
    payload?: Record<string, unknown>;
}

export type TransportMessage = MqttMessage | HttpMessage | TuyaMessage | ZigbeeMessage;

export interface DeviceTransportService {
    readonly protocol: TransportProtocol;
    send(message: TransportMessage): Promise<void>;
}
