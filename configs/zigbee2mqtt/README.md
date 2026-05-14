# Zigbee2MQTT Configuration

This directory contains the Zigbee2MQTT configuration files.

## Files

- `configuration.yaml` - Main configuration file (committed to git)
- `secret.yaml` - Secrets file containing MQTT credentials (NOT committed to git)

## Setup

Create a `secret.yaml` file in this directory with the following content:

```yaml
mqtt_user: zigbee2mqtt
mqtt_password: <your_mqtt_password>
```

Make sure to add the `zigbee2mqtt` user to the Mosquitto password file:

```bash
docker exec -it mqtt-broker mosquitto_passwd /mosquitto/config/pwfile zigbee2mqtt
```

## Hardware

This configuration is designed for the SONOFF Zigbee 3.0 & Thread Dongle Lite (EFR32MG21).

### Firmware Requirements

Ensure the dongle has EmberZNet NCP 7.4+ firmware flashed. The default configuration uses the `ember` adapter.

### Device Path

Set the `ZIGBEE_DONGLE_PATH` environment variable to the device path of your Zigbee dongle.
Prefer using the stable `/dev/serial/by-id/` path:

```bash
ZIGBEE_DONGLE_PATH=/dev/serial/by-id/usb-Silicon_Labs_<your_dongle_id>-if00-port0
```
