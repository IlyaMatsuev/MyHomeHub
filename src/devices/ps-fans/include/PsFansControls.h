#pragma once

#include "SmartHomeDevice.h"

struct FanSpeedLevel {
    float speedPercentage;
    uint8_t duty;
    // When temperature rises above this value, the duty of this level is used
    float higherTemperatureThreshold;
    // When temperature decreases below this value, the duty of this level is used
    float lowerTemperatureThreshold;
};

class PsFansControls : public ControlsProvider {
public:
    PsFansControls();

    void onUpdate(JsonDocument& payload) override;
    FanSpeedLevel getFanSpeedLevel(float temperature);
protected:
    void build(JsonDocument& controls) override;
private:
    bool on;
};
