#include <cmath>
#include "PsFansControls.h"


FanSpeedLevel::FanSpeedLevel(float speedPercentage, float highTemp, float lowTemp):
    speedPercentage(speedPercentage),
    duty(static_cast<uint8_t>(std::ceil(speedPercentage * FAN_MAX_DUTY))),
    highTemp(highTemp),
    lowTemp(lowTemp) {}

PsFansControls::PsFansControls() {
    this->on = true;
    this->fanSpeedLevels = this->getDefaultFanSpeedLevels();
}

/*
{
  "on": true,
  "speedLevels": {
    "reset": false,
    "0.25": { "highTemp": 25, "lowTemp": 23 },
    "0.5": { "highTemp": 30, "lowTemp": 28 },
    "1": { "highTemp": 35, "lowTemp": 33 },
  }
}
 */
void PsFansControls::onUpdate(JsonObject& payload) {
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
                        level.highTemp = speedLevelConfig["highTemp"];
                        level.lowTemp = speedLevelConfig["lowTemp"];
                    }
                }
            }
        }
    }
}

void PsFansControls::build(JsonObject& controls) {
    controls["on"] = this->on;

    JsonObject speedLevels;
    speedLevels["reset"] = false;
    
    JsonObject speedLevel25 = speedLevels["0.25"].to<JsonObject>();
    speedLevel25["highTemp"] = this->fanSpeedLevels[1].highTemp;
    speedLevel25["lowTemp"] = this->fanSpeedLevels[1].lowTemp;
    JsonObject speedLevel50 = speedLevels["0.5"].to<JsonObject>();
    speedLevel50["highTemp"] = this->fanSpeedLevels[2].highTemp;
    speedLevel50["lowTemp"] = this->fanSpeedLevels[2].lowTemp;
    JsonObject speedLevel100 = speedLevels["1"].to<JsonObject>();
    speedLevel100["highTemp"] = this->fanSpeedLevels[3].highTemp;
    speedLevel100["lowTemp"] = this->fanSpeedLevels[3].lowTemp;

    controls["speedLevels"] = speedLevels;
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
        if (temperature >= nextLevel.highTemp) {
            this->currentSpeedLevelIndex++;
        }
    }
    if (notFirstLevel) {
        FanSpeedLevel currentLevel = this->fanSpeedLevels[this->currentSpeedLevelIndex];
        if (temperature <= currentLevel.lowTemp) {
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
