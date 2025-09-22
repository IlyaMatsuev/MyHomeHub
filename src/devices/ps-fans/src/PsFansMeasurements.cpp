#include <DallasTemperature.h>
#include "PsFansMeasurements.h"

PsFansMeasurements::PsFansMeasurements() {
    toggleIntervalUpdates(true);
    this->temperature = 0;
}

float PsFansMeasurements::setTemperature(float temperature) {
    if (temperature == DEVICE_DISCONNECTED_C) {
        temperature = this->temperature;
        Serial.printf("Temperature sensor glitch, using last loop reading: %.2f C\n", temperature);
    }
    return this->temperature = temperature;
}

void PsFansMeasurements::setFanSpeedLevel(float speedPercentage) {
    this->speedPercentage = speedPercentage;
}

void PsFansMeasurements::build(JsonObject& measurements) {
    measurements["temperature"] = this->temperature;
    measurements["speedPercentage"] = this->speedPercentage;
}
