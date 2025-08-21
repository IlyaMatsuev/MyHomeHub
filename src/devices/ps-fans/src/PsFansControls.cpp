#include "PsFansControls.h"
#include <array>


std::array<FanSpeedLevel, 4> fanSpeedLevels {{
    { 0, 0, 0, 0 },
    { 0.25, 64, 35, 25 },
    { 0.5, 128, 50, 40 },
    { 1, 255, 80, 70 }
    // Values to test in room temperature:
    // { 0.25, 64, 25, 23 },
    // { 0.5, 128, 30, 28 },
    // { 1, 255, 37, 35 }
}};
uint8_t currentSpeedLevelIndex = 0;

const uint8_t TEMP_LEVEL1 = 25;
const uint8_t TEMP_LEVEL2 = 30;
const uint8_t TEMP_LEVEL3 = 35;


PsFansControls::PsFansControls() {
    this->on = true;
}

void PsFansControls::onUpdate(JsonDocument& payload) {
    this->on = payload["on"];
}

void PsFansControls::build(JsonDocument& controls) {
    controls["on"] = this->on;
}

FanSpeedLevel PsFansControls::getFanSpeedLevel(float temperature) {
    if (!this->on) {
        currentSpeedLevelIndex = 0;
        return fanSpeedLevels[currentSpeedLevelIndex];
    }

    bool notLastLevel = currentSpeedLevelIndex < fanSpeedLevels.size() - 1;
    bool notFirstLevel = currentSpeedLevelIndex > 0;

    if (notLastLevel) {
        FanSpeedLevel nextLevel = fanSpeedLevels[currentSpeedLevelIndex + 1];
        if (temperature >= nextLevel.higherTemperatureThreshold) {
            currentSpeedLevelIndex++;
        }
    }
    if (notFirstLevel) {
        FanSpeedLevel currentLevel = fanSpeedLevels[currentSpeedLevelIndex];
        if (temperature <= currentLevel.lowerTemperatureThreshold) {
            currentSpeedLevelIndex--;
        }
    }
    return fanSpeedLevels[currentSpeedLevelIndex];
}
