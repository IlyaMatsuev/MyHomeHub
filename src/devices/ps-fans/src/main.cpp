#include <Arduino.h>
#include "SmartHomeDevice.h"
#include "PsFansControls.h"
#include "PsFansMeasurements.h"
#include "secrets.h"

const uint8_t FAN_POWER_PIN = 15;
const uint8_t SWITCH_BUTTON_PIN = 18;

// NetworkSettings networkSettings(NETWORK_SSID, NETWORK_PASSWORD);
// MqttSettings mqttSettings(MQTT_HOSTNAME, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD);

// PsFansMeasurements measurements;
// PsFansControls controls;

// SmartHomeDevice device(
//     "esp32-office",
//     &measurements,
//     &controls
// );

bool isOn = false;


void setup() {
    Serial.begin(115200);
    pinMode(FAN_POWER_PIN, OUTPUT);
    pinMode(SWITCH_BUTTON_PIN, INPUT);
    //device.setup(networkSettings, mqttSettings);
}

void loop() {
    //device.loop();

    bool switchPressed = digitalRead(SWITCH_BUTTON_PIN) != 0;

    if (switchPressed) {
        isOn = !isOn;
        Serial.printf("Switch pressed, new value %d\n", isOn);
    }

    digitalWrite(FAN_POWER_PIN, isOn ? HIGH : LOW);
    delay(300);
}