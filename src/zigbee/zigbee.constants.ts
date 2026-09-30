export const ZIGBEE_DEVICE_STATE_TOPIC = 'zigbee2mqtt/+';

export const ZIGBEE_BRIDGE_HEALTH = 'zigbee2mqtt/bridge/health';
export const ZIGBEE_BRIDGE_STATE_TOPIC = 'zigbee2mqtt/bridge/state';
export const ZIGBEE_BRIDGE_DEVICES_TOPIC = 'zigbee2mqtt/bridge/devices';
export const ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC = 'zigbee2mqtt/bridge/request/permit_join';

export const ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC = 'zigbee2mqtt/bridge/request/device/rename';
export const ZIGBEE_BRIDGE_DEVICE_RENAME_RESPONSE_TOPIC = 'zigbee2mqtt/bridge/response/device/rename';
export const ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC = 'zigbee2mqtt/bridge/request/device/remove';

export const ZIGBEE_MONITOR_JOB_NAME = 'zigbee-health-monitor';
export const ZIGBEE_MONITOR_INTERVAL_MS = 60_000;

// Defaults are derived from the zigbee2mqtt health report interval, which is 10 minutes out of the box
export const DEFAULT_ZIGBEE_HEALTH_TIMEOUT_SEC = 1800;
export const DEFAULT_ZIGBEE_SILENCE_TIMEOUT_SEC = 3600;
