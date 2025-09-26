export interface DevicePayload {
    $override?: boolean;
    [key: string]: unknown;
}

export interface DeviceControls extends DevicePayload {
    on?: boolean;
    onSwitchDelay?: number;
}
