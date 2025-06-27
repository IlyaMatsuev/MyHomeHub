#pragma once

#include "SmartHomeDevice.h"

class PsFansMeasurements : public MeasurementsProvider {
public:
    PsFansMeasurements() {
        toggleIntervalUpdates(false);
    }

protected:
    void build(JsonDocument& measurements) override {}
};
