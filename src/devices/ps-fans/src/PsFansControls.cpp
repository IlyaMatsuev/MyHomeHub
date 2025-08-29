#include <cmath>
#include "PsFansControls.h"


FanSpeedLevel::FanSpeedLevel(float speedPercentage, float higherTemperatureThreshold, float lowerTemperatureThreshold):
    speedPercentage(speedPercentage),
    duty(static_cast<uint8_t>(std::ceil(speedPercentage * FAN_MAX_DUTY))),
    higherTemperatureThreshold(higherTemperatureThreshold),
    lowerTemperatureThreshold(lowerTemperatureThreshold) {}

PsFansControls::PsFansControls() {
    this->on = true;
    this->fanSpeedLevels = this->getDefaultFanSpeedLevels();
}

/*
{
  "on": true,
  "speedLevels": {
    "reset": true,
    "0.25": { "higherTemperatureThreshold": 25, "lowerTemperatureThreshold": 23 },
    "0.5": { "higherTemperatureThreshold": 30, "lowerTemperatureThreshold": 28 },
  }
}
 */
void PsFansControls::onUpdate(JsonDocument& payload) {
    this->on = payload["on"];
    if (payload["speedLevels"].is<JsonObject>()) {
        JsonObject speedLevels = payload["speedLevels"];

        if (speedLevels["reset"].as<bool>()) {
            this->fanSpeedLevels = this->getDefaultFanSpeedLevels();
        } else {
            for (JsonPair kv : speedLevels) {
                if (strcmp(kv.key().c_str(), "reset") == 0) {
                    continue;
                }

                float speedPercentage = atoff(kv.key().c_str());

                for (FanSpeedLevel& level : fanSpeedLevels) {
                    // Because float value internally could be 0.25000001
                    if (fabs(level.speedPercentage - speedPercentage) < 0.001) {
                        JsonObject speedLevelConfig = kv.value().as<JsonObject>();
                        level.higherTemperatureThreshold = speedLevelConfig["higherTemperatureThreshold"];
                        level.lowerTemperatureThreshold = speedLevelConfig["lowerTemperatureThreshold"];
                    }
                }
            }
        }
    }
}

void PsFansControls::build(JsonDocument& controls) {
    controls["on"] = this->on;
}

FanSpeedLevel PsFansControls::getFanSpeedLevel(float temperature) {
    if (!this->on) {
        this->currentSpeedLevelIndex = 0;
        return this->fanSpeedLevels[this->currentSpeedLevelIndex];
    }

    bool notLastLevel = this->currentSpeedLevelIndex < this->fanSpeedLevels.size() - 1;
    bool notFirstLevel = this->currentSpeedLevelIndex > 0;

    if (notLastLevel) {
        FanSpeedLevel nextLevel = this->fanSpeedLevels[this->currentSpeedLevelIndex + 1];
        if (temperature >= nextLevel.higherTemperatureThreshold) {
            this->currentSpeedLevelIndex++;
        }
    }
    if (notFirstLevel) {
        FanSpeedLevel currentLevel = this->fanSpeedLevels[this->currentSpeedLevelIndex];
        if (temperature <= currentLevel.lowerTemperatureThreshold) {
            this->currentSpeedLevelIndex--;
        }
    }
    return this->fanSpeedLevels[this->currentSpeedLevelIndex];
}

std::vector<FanSpeedLevel> PsFansControls::getDefaultFanSpeedLevels() {
    return {
        FanSpeedLevel(0, 0, 0),
        FanSpeedLevel(0.25, 28, 25),
        FanSpeedLevel(0.5, 32, 29),
        FanSpeedLevel(1, 35, 33)
        // Values to test in room temperature:
        // FanSpeedLevel(0.25, 25, 23),
        // FanSpeedLevel(0.5, 30, 28),
        // FanSpeedLevel(1, 34, 32)
    };
}
