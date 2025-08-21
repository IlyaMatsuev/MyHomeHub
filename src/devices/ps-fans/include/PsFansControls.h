#pragma once

#include "SmartHomeDevice.h"

class PsFansControls : public ControlsProvider {
public:
    PsFansControls();

    void onUpdate(JsonDocument& payload) override;
    uint8_t getDuty(float temperature);
protected:
    void build(JsonDocument& controls) override;
private:
    bool on;
};
