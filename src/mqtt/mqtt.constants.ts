export const MQTT_CLIENT_PROVIDER_NAME = 'MQTT_CLIENT';
export const MQTT_TOPIC_PARTS_SEPARATOR = '/';
export const MQTT_TOPIC_PARTS_WILDCARD = '+';

export const DEVICE_PAIR_REQUEST_TOPIC_NAME = 'home/devices/pair';
export const DEVICE_PAIR_REPLY_TOPIC_NAME = 'home/devices/pair/reply';
export const CONTROLS_UPDATE_TOPIC_NAME = 'home/devices/+/controls/update';
export const CONTROLS_SYNC_TOPIC_NAME = 'home/devices/+/controls/sync';
export const MEASUREMENTS_UPDATE_TOPIC_NAME = 'home/devices/+/measurements/update';

export const MEASUREMENTS_DEFAULT_UPDATE_INTERVAL = 1000 * 60 * 5;

export const ZIGBEE2MQTT_BASE_TOPIC = 'zigbee2mqtt';
export const ZIGBEE_DEVICE_STATE_TOPIC = 'zigbee2mqtt/+';
export const ZIGBEE_DEVICE_COMMAND_TOPIC = 'zigbee2mqtt/+/set';
export const ZIGBEE_BRIDGE_STATE_TOPIC = 'zigbee2mqtt/bridge/state';
export const ZIGBEE_BRIDGE_DEVICES_TOPIC = 'zigbee2mqtt/bridge/devices';
export const ZIGBEE_BRIDGE_EVENT_TOPIC = 'zigbee2mqtt/bridge/event';
export const ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC = 'zigbee2mqtt/bridge/request/permit_join';
export const ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC = 'zigbee2mqtt/bridge/request/device/rename';
export const ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC = 'zigbee2mqtt/bridge/request/device/remove';
