#pragma once

#include "SmartHomeDevice.h"

class PsFansMeasurements : public MeasurementsProvider {
public:
    PsFansMeasurements();

    float setTemperature(float temperature);
protected:
    void build(JsonDocument& measurements) override;
private:
    float temperature;
};
