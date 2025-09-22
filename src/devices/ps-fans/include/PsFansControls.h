#pragma once

#include <vector>
#include "SmartHomeDevice.h"


const uint8_t FAN_MAX_DUTY = 255;

struct FanSpeedLevel {
    float speedPercentage;
    uint8_t duty;
    // When temperature rises above this value, the duty of this level is used
    float highTemp;
    // When temperature drops below this value, the duty of the below level is used
    float lowTemp;

    FanSpeedLevel(float speedPercentage, float highTemp, float lowTemp);
};

class PsFansControls : public ControlsProvider {
public:
    PsFansControls();

    void onUpdate(JsonObject& payload) override;
    FanSpeedLevel getFanSpeedLevel(float temperature);
protected:
    void build(JsonObject& controls) override;
private:
    bool on;

    uint8_t currentSpeedLevelIndex = 0;
    std::vector<FanSpeedLevel> fanSpeedLevels;

    std::vector<FanSpeedLevel> getDefaultFanSpeedLevels();
};
