#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "SmartHomeDevice.h"
#include "PsFansControls.h"
#include "PsFansMeasurements.h"
#include "secrets.h"

const uint8_t FAN_PWM_CHANNEL = 0;
const int FAN_PWM_FREQUENCY = 25000;
const uint8_t FAN_PWM_RESOLUTION = 8;
const uint8_t FAN_POWER_PIN = 18;

const uint8_t TEMP_SENSOR_PIN = 19;
const uint8_t TEMP_SENSOR_RESOLUTION = 11;
// TODO: Modify with proper temperature levels
const uint8_t TEMP_LEVEL1 = 25;
const uint8_t TEMP_LEVEL2 = 30;
const uint8_t TEMP_LEVEL3 = 35;

OneWire oneWire(TEMP_SENSOR_PIN);
DallasTemperature sensors(&oneWire);

// NetworkSettings networkSettings(NETWORK_SSID, NETWORK_PASSWORD);
// MqttSettings mqttSettings(MQTT_HOSTNAME, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD);

// PsFansMeasurements measurements;
// PsFansControls controls;

// SmartHomeDevice device(
//     "esp32-office",
//     &measurements,
//     &controls
// );

float lastLoopTemperature = 0;

float readTemperature();


void setup() {
    Serial.begin(115200);
    // pinMode(FAN_POWER_PIN, OUTPUT);
    // pinMode(SWITCH_BUTTON_PIN, INPUT_PULLUP);
    //device.setup(networkSettings, mqttSettings);

    ledcSetup(FAN_PWM_CHANNEL, FAN_PWM_FREQUENCY, FAN_PWM_RESOLUTION);
    ledcAttachPin(FAN_POWER_PIN, FAN_PWM_CHANNEL);
    ledcWrite(FAN_PWM_CHANNEL, 0);

    sensors.begin();
    sensors.setResolution(TEMP_SENSOR_RESOLUTION);
}

void loop() {
    sensors.requestTemperatures();
    float temperature = readTemperature();

    uint8_t duty = 0;

    if (temperature < TEMP_LEVEL1) {
        duty = 0;
    } else if (temperature < TEMP_LEVEL2) {
        duty = 64;
    } else if (temperature < TEMP_LEVEL3) {
        duty = 128;
    } else {
        duty = 255;
    }

    Serial.printf("Temperature: %.2f C, duty: %d\n", temperature, duty);

    ledcWrite(FAN_PWM_CHANNEL, duty);

    delay(500);

    //device.loop();
}

float readTemperature() {
    float temperature = sensors.getTempCByIndex(0);
    if (temperature == DEVICE_DISCONNECTED_C) {
        temperature = lastLoopTemperature;
        Serial.printf("Temperature sensor glitch, using last loop reading: %.2f C\n", temperature);
    }
    lastLoopTemperature = temperature;
    return temperature;
}
