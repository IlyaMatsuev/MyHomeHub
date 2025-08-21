#include "PsFansControls.h"

// TODO: Modify with proper temperature levels
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

uint8_t PsFansControls::getDuty(float temperature) {
    if (!this->on || temperature < TEMP_LEVEL1) {
        return 0;
    }
    if (temperature < TEMP_LEVEL2) {
        return 64;
    }
    if (temperature < TEMP_LEVEL3) {
        return 128;
    }
    return 255;
}
