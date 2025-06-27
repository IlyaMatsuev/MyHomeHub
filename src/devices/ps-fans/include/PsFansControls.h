#pragma once

#include "SmartHomeDevice.h"

class PsFansControls : public ControlsProvider {
public:
    bool on = true;

    void onUpdate(JsonDocument& payload) override {
        on = payload["on"];
    }
protected:
    void build(JsonDocument& controls) override {
        controls["on"] = on;
    }
};
