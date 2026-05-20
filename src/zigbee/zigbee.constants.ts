export const ZIGBEE_DEVICE_STATE_TOPIC = 'zigbee2mqtt/+';
export const ZIGBEE_BRIDGE_DEVICES_TOPIC = 'zigbee2mqtt/bridge/devices';
export const ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC = 'zigbee2mqtt/bridge/request/permit_join';
export const ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC = 'zigbee2mqtt/bridge/request/device/rename';
export const ZIGBEE_BRIDGE_DEVICE_RENAME_RESPONSE_TOPIC = 'zigbee2mqtt/bridge/response/device/rename';
export const ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC = 'zigbee2mqtt/bridge/request/device/remove';

export const Z2M_SUPPORTED_CONTROLS = new Set(['action']);
export const Z2M_SUPPORTED_MEASUREMENTS = new Set(['battery', 'linkquality']);
