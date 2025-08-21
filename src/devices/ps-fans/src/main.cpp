#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "SmartHomeDevice.h"
#include "PsFansControls.h"
#include "PsFansMeasurements.h"
#include "secrets.h"

const uint8_t FAN_POWER_PIN = 18;
const uint8_t FAN_PWM_CHANNEL = 0;
const int FAN_PWM_FREQUENCY = 25000;
const uint8_t FAN_PWM_RESOLUTION = 8;

const uint8_t TEMP_SENSOR_PIN = 19;
const uint8_t TEMP_SENSOR_RESOLUTION = 11;

OneWire oneWire(TEMP_SENSOR_PIN);
DallasTemperature sensors(&oneWire);

NetworkSettings networkSettings(NETWORK_SSID, NETWORK_PASSWORD);
MqttSettings mqttSettings(MQTT_HOSTNAME, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD);

PsFansMeasurements measurements;
PsFansControls controls;

SmartHomeDevice device(
    "ps-fans",
    &measurements,
    &controls
);


void setup() {
    Serial.begin(115200);
    device.setup(networkSettings, mqttSettings);

    ledcSetup(FAN_PWM_CHANNEL, FAN_PWM_FREQUENCY, FAN_PWM_RESOLUTION);
    ledcAttachPin(FAN_POWER_PIN, FAN_PWM_CHANNEL);
    ledcWrite(FAN_PWM_CHANNEL, 0);

    sensors.begin();
    sensors.setResolution(TEMP_SENSOR_RESOLUTION);
}

void loop() {
    sensors.requestTemperatures();
    float temperature = measurements.setTemperature(sensors.getTempCByIndex(0));
    uint8_t duty = controls.getDuty(temperature);

    Serial.printf("Temperature: %.2f C, duty: %d\n", temperature, duty);

    ledcWrite(FAN_PWM_CHANNEL, duty);

    device.loop();
    delay(500);
}

