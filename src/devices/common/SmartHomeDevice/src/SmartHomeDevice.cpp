#include "SmartHomeDevice.h"

const int MQTT_CONNECT_RETRY_DELAY = 5000;
const int PAIR_REQUEST_INTERVAL = 5000;

const char* PAIR_REQUEST_TOPIC = "home/devices/pair";
const char* PAIR_REQUEST_REPLY_TOPIC = "home/devices/pair/reply";
const char* UPDATE_CONTROLS_TOPIC = "home/devices/%s/controls/update";
const char* SYNC_CONTROLS_TOPIC = "home/devices/%s/controls/sync";
const char* UPDATE_MEASUREMENTS_TOPIC = "home/devices/%s/measurements/update";


JsonDocument& PayloadProvider::getPayload() {
    JsonDocument values;
    build(values);
    payload[payloadField] = values;
    return payload;
}

void ControlsProvider::toggleControlsSync(bool sync) {
    this->controlsSynced = !sync;
}

bool ControlsProvider::controlsUpdated() {
    return this->controlsSynced;
}

void MeasurementsProvider::toggleIntervalUpdates(bool enable) {
    this->enableIntervalUpdates = enable;
}

bool MeasurementsProvider::intervalUpdatesEnabled() {
    return this->enableIntervalUpdates;
}

void SmartHomeDevice::setup(const NetworkSettings& networkSettings, const MqttSettings& mqttSettings) {
    this->networkSettings = networkSettings;
    this->mqttSettings = mqttSettings;

    connectWiFi(this->networkSettings.wifiSsid, this->networkSettings.wifiPassword);

    mqttClient.setServer(this->mqttSettings.hostname, this->mqttSettings.port);
    mqttClient.setCallback([this](char* topic, byte* messageBytes, unsigned int length) {
        Serial.printf("\nMessage received [%s]: %.*s\n", topic, length, messageBytes);

        JsonDocument data;
        DeserializationError error = deserializeJson(data, messageBytes, length);
        if (error) {
            Serial.printf("Failed to deserialize JSON: %s\n", error.c_str());
        } else {
            this->onMqttMessage(String(topic), data["data"]);
        }
    });
    connectMqtt(this->mqttSettings.username, this->mqttSettings.password);
}

void SmartHomeDevice::loop() {
    if (!WiFi.isConnected()) {
        connectWiFi(this->networkSettings.wifiSsid, this->networkSettings.wifiPassword);
    }
    if (!mqttClient.connected()) {
        connectMqtt(this->mqttSettings.username, this->mqttSettings.password);
    }
    mqttClient.loop();

    Serial.printf("Device id: %s, ms since last pair: %d, ms since last update: %d\n", deviceId.c_str(), msSinceLastPairRequest(), msSinceLastUpdate());
    if (!isPaired() && msSinceLastPairRequest() >= PAIR_REQUEST_INTERVAL) {
        sendPairRequest();
        lastPairRequest = millis();
    }

    if (isPaired() && measurementsProvider->intervalUpdatesEnabled() && msSinceLastUpdate() >= updateIntervalMs) {
        sendMeasurementsUpdate();
        lastUpdate = millis();
    }

    if (isPaired() && !controlsProvider->controlsUpdated()) {
        sendControlsSync();
        controlsProvider->toggleControlsSync(false);
    }
}

void SmartHomeDevice::connectWiFi(const char* ssid, const char* password) {
    WiFi.begin(ssid, password);
    Serial.print("Connecting to Wi-Fi");
    while (!WiFi.isConnected()) {
        delay(100);
        Serial.print(".");
    }
    deviceIp = WiFi.localIP();
    Serial.println("\nConnected to Wi-Fi, IP: " + deviceIp.toString());
}

void SmartHomeDevice::connectMqtt(const char* username, const char* password) {
    Serial.printf("\nConnecting to mqtt://%s:%d as %s\n", this->mqttSettings.hostname, this->mqttSettings.port, deviceName);
    while (!mqttClient.connected()) {
        if (mqttClient.connect(deviceName, username, password)) {
            mqttClient.setBufferSize(MAX_MQTT_PACKET_SIZE);
            mqttClient.subscribe(PAIR_REQUEST_REPLY_TOPIC);
            sendPairRequest();
        } else {
            Serial.printf("Failed to connect: %d\n, trying again in %d ms", mqttClient.state(), MQTT_CONNECT_RETRY_DELAY);
            delay(MQTT_CONNECT_RETRY_DELAY);
        }
    }
}

void SmartHomeDevice::onMqttMessage(String topic, JsonDocument data) {
    if (topic == PAIR_REQUEST_REPLY_TOPIC) {
        // { "accepted": true, "deviceId": "xxx", "updateInterval": 10000, "message": "example" }
        if (data["accepted"]) {
            deviceId = data["deviceId"].as<String>();
            updateIntervalMs = data["updateInterval"];
            Serial.printf("Received pairing acceptance (%s), with update interval: %d\n", deviceId.c_str(), updateIntervalMs);

            mqttClient.subscribe(getUpdateControlsTopic().c_str());
            mqttClient.unsubscribe(PAIR_REQUEST_REPLY_TOPIC);
        } else {
            Serial.printf("Pairing got rejected with message: %s\n", data["message"]);
        }
    }
    if (topic == getUpdateControlsTopic()) {
        // { ...controls } - Can contain any kind of controls
        Serial.println("Received controls update request");
        this->controlsProvider->onUpdate(data);
        // Toggle to sync all controls back to the hub
        this->controlsProvider->toggleControlsSync();
    }
}

bool SmartHomeDevice::isPaired() const {
    return deviceId.length() > 0;
}

void SmartHomeDevice::sendPairRequest() {
    JsonDocument request;
    request["deviceIp"] = deviceIp.toString();
    request["deviceName"] = deviceName;
    request["deviceType"] = deviceType;
    request["updateInterval"] = updateIntervalMs;
    request["controls"] = controlsProvider->getPayload();
    request["measurements"] = measurementsProvider->getPayload();

    char requestJson[MAX_MQTT_PACKET_SIZE];
    serializeJson(request, requestJson);
    Serial.printf("Sending pairing request: %s\n", requestJson);

    mqttClient.publish(PAIR_REQUEST_TOPIC, requestJson);
}

void SmartHomeDevice::sendMeasurementsUpdate() {
    char requestJson[MAX_MQTT_PACKET_SIZE];
    serializeJson(measurementsProvider->getPayload(), requestJson);
    Serial.printf("Sending measurements update: %s\n", requestJson);

    mqttClient.publish(getUpdateMeasurementsTopic().c_str(), requestJson);
}

void SmartHomeDevice::sendControlsSync() {
    char requestJson[MAX_MQTT_PACKET_SIZE];
    serializeJson(controlsProvider->getPayload(), requestJson);
    Serial.printf("Sending controls sync: %s\n", requestJson);

    mqttClient.publish(getSyncControlsTopic().c_str(), requestJson);
}

unsigned long SmartHomeDevice::msSinceLastPairRequest() {
    return millis() - lastPairRequest;
}

unsigned long SmartHomeDevice::msSinceLastUpdate() {
    return millis() - lastUpdate;
}

String SmartHomeDevice::getUpdateControlsTopic() {
    if (updateControlsTopic.length() == 0) {
        char topic[128];
        snprintf(topic, sizeof(topic), UPDATE_CONTROLS_TOPIC, deviceId.c_str());
        updateControlsTopic = topic;
    }
    return updateControlsTopic;
}

String SmartHomeDevice::getSyncControlsTopic() {
    if (syncControlsTopic.length() == 0) {
        char topic[128];
        snprintf(topic, sizeof(topic), SYNC_CONTROLS_TOPIC, deviceId.c_str());
        syncControlsTopic = topic;
    }
    return syncControlsTopic;
}

String SmartHomeDevice::getUpdateMeasurementsTopic() {
    if (updateMeasurementsTopic.length() == 0) {
        char topic[128];
        snprintf(topic, sizeof(topic), UPDATE_MEASUREMENTS_TOPIC, deviceId.c_str());
        updateMeasurementsTopic = topic;
    }
    return updateMeasurementsTopic;
}
