#include <Arduino.h>
#include "SmartHomeDevice.h"
#include "secrets.h"

class PsFansMeasurements : public MeasurementsProvider {
public:
    float temperature = 15.0;
protected:
    void build(JsonDocument& measurements) override {
        measurements["temperature"] = temperature;
    }
};

class PsFansControls : public ControlsProvider {
public:
    bool on = true;

    void onUpdate(JsonDocument& payload) override {
        on = payload["on"];
    }
protected:
    void build(JsonDocument& controls) override {
        controls["on"] = on;
    }
};


NetworkSettings networkSettings(NETWORK_SSID, NETWORK_PASSWORD);
MqttSettings mqttSettings(MQTT_HOSTNAME, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD);

PsFansMeasurements measurements;
PsFansControls controls;

SmartHomeDevice device(
    "esp32-office",
    &measurements,
    &controls
);

void setup() {
    Serial.begin(115200);
    device.setup(networkSettings, mqttSettings);
}

void loop() {
    device.loop();

    if (controls.on) {
        measurements.toggleIntervalUpdates();
        measurements.temperature += 0.1;
        Serial.printf("New termperature: %.2f\n", measurements.temperature);
    } else {
        measurements.toggleIntervalUpdates(false);
        Serial.println("Device is in Off state");
    }

    delay(500);
}