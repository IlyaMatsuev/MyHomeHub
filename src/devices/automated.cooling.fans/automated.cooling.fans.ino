const uint8_t TEMP_SENSOR_PIN = A0;
const uint8_t FAN_POWER_PIN = 8;
const uint8_t RED_LED_PIN = 9;
const uint8_t BLUE_LED_PIN = 10;
const uint8_t GREEN_LED_PIN = 11;

const float MAX_TEMP_SENSOR_VALUE = 1024.0;
const float MAX_PIN_VOLTAGE = 5.0;

const float FAN_WORK_START_TEMP = 40.0;
const float FAN_WORK_STOP_TEMP = 30.0;

typedef struct {
  uint8_t tempThreshold;
  uint8_t red;
  uint8_t green;
  uint8_t blue;
} TemperatureIndicator;

const TemperatureIndicator TEMPERATURE_INDICATORS[] {
  { 10, 0, 0, 255 },
  { 15, 102, 102, 255 },
  { 20, 204, 204, 255 },
  { 25, 255, 255, 255 },
  { 30, 255, 204, 204 },
  { 40, 255, 153, 153 },
  { 50, 255, 102, 102 },
  { 60, 255, 51, 51 },
  { 70, 255, 0, 0 }
};

uint8_t fanState = LOW;

void setup() {
  Serial.begin(9600);
  pinMode(FAN_POWER_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(BLUE_LED_PIN, OUTPUT);
}

void loop() {
  float temp = getSensorTemperature();

  signalTemperature(temp);

  if (fanState != HIGH && temp >= FAN_WORK_START_TEMP) {
    Serial.println("Activate fans");
    fanState = HIGH;
  }

  if (fanState != LOW && temp <= FAN_WORK_STOP_TEMP) {
    Serial.println("Deactivate fans");
    fanState = LOW;
  }

  digitalWrite(FAN_POWER_PIN, fanState);
  delay(1000);
}

float getSensorTemperature() {
  float sensorValue = (float) analogRead(TEMP_SENSOR_PIN);
  Serial.print("Temp sensor value: ");
  Serial.print(sensorValue);

  float sensorVoltage = (sensorValue / MAX_TEMP_SENSOR_VALUE) * MAX_PIN_VOLTAGE;
  Serial.print("; Sensor voltage: ");
  Serial.print(sensorVoltage);

  float temp = (sensorVoltage - .5) * 100.0;
  Serial.print("; Temperature: ");
  Serial.println(temp);
  return temp;
}

void signalTemperature(float temp) {
  uint8_t redValue = map(temp, min(10, temp), max(80, temp), 0, 255);

  uint8_t indicatorsSize = sizeof(TEMPERATURE_INDICATORS) / sizeof(TemperatureIndicator);
  uint8_t newIndicatorIndex = indicatorsSize - 1;
  for (uint8_t i = 0; i < indicatorsSize; i++) {
    TemperatureIndicator indicator = TEMPERATURE_INDICATORS[i];
    if (temp <= (float) indicator.tempThreshold) {
      newIndicatorIndex = i;
      break;
    }
  }

  // Need to make smooth transition from one color to another
  TemperatureIndicator indicator = TEMPERATURE_INDICATORS[newIndicatorIndex];

  digitalWrite(RED_LED_PIN, indicator.red);
  digitalWrite(GREEN_LED_PIN, indicator.green);
  digitalWrite(BLUE_LED_PIN, indicator.blue);
}
