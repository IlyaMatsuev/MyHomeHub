#pragma once

#include "SmartHomeDevice.h"

class PsFansMeasurements : public MeasurementsProvider {
public:
    PsFansMeasurements();

    float setTemperature(float temperature);
    void setFanSpeedLevel(float speedPercentage);
protected:
    void build(JsonDocument& measurements) override;
private:
    float temperature;
    float speedPercentage;
};
