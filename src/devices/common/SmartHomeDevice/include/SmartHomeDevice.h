#pragma once

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Increase if JSON messages become large than 1MB
const unsigned int MAX_MQTT_PACKET_SIZE = 1024;
const unsigned int DEFAULT_UPDATE_INTERVAL = 5000;

class PayloadProvider {
public:
    JsonObject& getPayload();
protected:
    PayloadProvider(const char* fieldName) : payloadField(fieldName) {}

    virtual void build(JsonObject& payload) = 0;
private:
    JsonObject payload;
    const char* payloadField;
};

class ControlsProvider : public PayloadProvider {
public:
    ControlsProvider() : PayloadProvider("controls") {}

    virtual void onUpdate(JsonObject& payload) = 0;
    void toggleControlsSync(bool sync = true);
    bool controlsUpdated();
private:
    bool controlsSynced = true;
};

class MeasurementsProvider : public PayloadProvider {
public:
    MeasurementsProvider() : PayloadProvider("measurements") {}

    void toggleIntervalUpdates(bool enable = true);
    bool intervalUpdatesEnabled();
private:
    bool enableIntervalUpdates = true;
};

struct NetworkSettings {
    const char* wifiSsid;
    const char* wifiPassword;

    NetworkSettings()
        : wifiSsid(nullptr), wifiPassword(nullptr) {}

    NetworkSettings(const char* wifiSsid, const char* wifiPassword)
        : wifiSsid(wifiSsid), wifiPassword(wifiPassword) {}
};

struct MqttSettings {
    const char* hostname;
    int port;
    const char* username;
    const char* password;

    MqttSettings()
        : hostname(nullptr), port(1883), username(nullptr), password(nullptr) {}

    MqttSettings(const char* hostname, const int port, const char* username, const char* password)
        : hostname(hostname), port(port), username(username), password(password) {}
};

class SmartHomeDevice {
public:
    SmartHomeDevice(
        const char* deviceName,
        const char* deviceType,
        MeasurementsProvider* measurementsProvider,
        ControlsProvider* controlsProvider,
        unsigned long updateIntervalMs = DEFAULT_UPDATE_INTERVAL
    ) :
        deviceName(deviceName),
        deviceType(deviceType),
        measurementsProvider(measurementsProvider),
        controlsProvider(controlsProvider),
        updateIntervalMs(updateIntervalMs),
        mqttClient(wifiClient) {}

    void setup(const NetworkSettings& networkSettings, const MqttSettings& mqttSettings);
    void loop();

private:
    const char* deviceName;
    const char* deviceType;
    MeasurementsProvider* measurementsProvider;
    ControlsProvider* controlsProvider;
    unsigned long updateIntervalMs;

    NetworkSettings networkSettings;
    MqttSettings mqttSettings;

    WiFiClient wifiClient;
    PubSubClient mqttClient;
    IPAddress deviceIp;
    String deviceId;

    String updateControlsTopic;
    String syncControlsTopic;
    String updateMeasurementsTopic;

    unsigned long lastPairRequest = 0;
    unsigned long lastUpdate = 0;

    void connectWiFi(const char* ssid, const char* password);
    void connectMqtt(const char* username, const char* password);
    void onMqttMessage(String topic, JsonObject data);
    void sendPairRequest();
    void sendMeasurementsUpdate();
    void sendControlsSync();
    bool isPaired() const;

    unsigned long msSinceLastPairRequest();
    unsigned long msSinceLastUpdate();

    String getUpdateControlsTopic();
    String getSyncControlsTopic();
    String getUpdateMeasurementsTopic();
};
