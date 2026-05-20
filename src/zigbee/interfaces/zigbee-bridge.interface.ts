export interface ZigbeeBridgeOsHealth {
    load_average: Array<number>;
    memory_used_mb: number;
    memory_percent: number;
}

export interface ZigbeeBridgeProcessHealth {
    uptime_sec: number;
    memory_used_mb: number;
    memory_percent: number;
}

export interface ZigbeeBridgeMqttHealth {
    connected: boolean;
    queued: number;
    published: number;
    received: number;
}

export interface ZigbeeBridgeDeviceHealth {
    leave_count: number;
    network_address_changes: number;
    messages: number;
    messages_per_sec: number;
}

export interface ZigbeeBridgeDevicesHealth {
    [key: string]: ZigbeeBridgeDeviceHealth;
}

// Docs: https://www.zigbee2mqtt.io/guide/usage/health.html
export interface ZigbeeBridgeHealth {
    response_time: number;
    os: ZigbeeBridgeOsHealth;
    process: ZigbeeBridgeProcessHealth;
    mqtt: ZigbeeBridgeMqttHealth;
    devices: ZigbeeBridgeDevicesHealth;
}
