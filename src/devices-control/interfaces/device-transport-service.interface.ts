export enum TransportProtocol {
    Mqtt = 'mqtt',
    Http = 'http',
}

export interface MqttMessage {
    protocol: TransportProtocol.Mqtt;
    topic: string;
    topicParams?: Array<string>;
    payload?: Record<string, unknown>;
}

export interface HttpMessage {
    protocol: TransportProtocol.Http;
    method: 'GET' | 'POST';
    url: string;
    payload?: Record<string, unknown>;
}

export type TransportMessage = MqttMessage | HttpMessage;

export interface DeviceTransportService {
    readonly protocol: TransportProtocol;
    send(message: TransportMessage): Promise<void>;
}
