# Zigbee2MQTT Integration Plan

## Goal

Add support for Zigbee devices to the SmartHome Hub using the SONOFF Zigbee 3.0 & Thread Dongle Lite (EFR32MG21) as the coordinator, with [Zigbee2MQTT](https://www.zigbee2mqtt.io/) (Z2M) acting as a bridge between the dongle and the existing Mosquitto broker. The hub then talks to Zigbee devices using the same MQTT plumbing it already uses for ESP32, by adding a new device brand and a new `DeviceControlServiceFactory`.

## High-level Architecture

```
+----------------------+      USB       +----------------------+      MQTT       +----------------------+
| SONOFF Dongle Lite   | <------------> | zigbee2mqtt (Docker) | <-------------> | Mosquitto (broker)   |
| (EFR32MG21, EmberZ)  |   (serial)     |  + data/ volume      |  zigbee2mqtt/#  |   port 1885          |
+----------------------+                +----------------------+                 +----------+-----------+
                                                                                            ^
                                                                                            | MQTT (existing)
                                                                                            v
                                                                                +-----------+-----------+
                                                                                | smarthome-hub (NestJS)|
                                                                                |  ZigbeeControlService |
                                                                                +-----------------------+
```

Key design choice: **the hub never talks to the dongle directly.** Z2M owns the serial port and the Zigbee network; the hub only consumes/publishes JSON on `zigbee2mqtt/...` topics on the broker we already run. This keeps the existing factory pattern intact and avoids pulling a USB/serial dependency into Node.

---

## 1. Hardware: prepare the SONOFF dongle

The "Dongle Lite" ships with one of two firmwares depending on batch:

- **EmberZNet (Silicon Labs)** — what Z2M wants.
- **OpenThread / RCP** — Matter only. **Not** Z2M-compatible.

Verify and (if needed) flash via the [SONOFF web flasher](https://sonoff-zigbee-firmware.web.app/) (Chrome/Edge required for WebSerial) or `silabs-firmware-flasher`:

1. Plug the dongle into the host that will run Docker (a Raspberry Pi or the same host as the rest of the stack).
2. Confirm the device node — typically `/dev/ttyUSB0` (CP2102N) or `/dev/serial/by-id/usb-Silicon_Labs_*-if00-port0`. Prefer the stable `by-id` path in compose mounts; `/dev/ttyUSB0` can renumber on reboot.
3. Flash the latest **EmberZNet NCP 7.4.x+** firmware. The "Lite" has 768 KB flash — use the NCP variant labeled for the Lite, not the Plus.
4. Reboot. The device should re-enumerate at the same `by-id` path.

**Why EmberZNet 7.4+:** Z2M ≥ 2.0 (Nov 2024) introduced the `ember` adapter as the supported path for Silicon Labs coordinators. The older `ezsp` path is deprecated.

---

## 2. Run Zigbee2MQTT alongside the existing stack

Add a new service to `docker-compose.yaml`. Reuse the existing Mosquitto broker rather than spinning up a second one.

### 2.1 Mosquitto adjustments

The current `mosquitto.conf` listens on port **1885** (non-standard) and requires auth. Z2M needs to reach it from inside the bridge network. Two options:

- **Option A (recommended):** keep 1885 and configure Z2M's `mqtt.server` to `mqtt://mqtt-broker:1885`. No change to mosquitto config beyond putting it on a shared docker network (it already is via `smarthome-network`).
- **Option B:** add a second listener on 1883 in `mosquitto.conf`. More work, only worth it if other off-the-shelf integrations expect 1883.

Pick A. Add a dedicated MQTT user `zigbee2mqtt` in `configs/mqtt/pwfile` (use `mosquitto_passwd`) so Z2M's connection is auditable separately from the hub's. ACL (optional, later): restrict that user to `zigbee2mqtt/#`.

### 2.2 Config vs state split

Z2M lumps everything into one `/app/data` directory by default, but it's a mix of config (yaml files, version-controlled) and runtime state (`database.db`, `coordinator_backup.json`, `state.json`, `log/`). Follow the project's existing convention by splitting them:

- `configs/zigbee2mqtt/configuration.yaml` — committed to git, matches `configs/mqtt/mosquitto.conf`.
- `configs/zigbee2mqtt/secret.yaml` — gitignored, matches how `configs/mqtt/pwfile` is treated.
- `data/zigbee2mqtt/` — gitignored runtime state (network database, logs, backups). Matches the existing `data/${NODE_ENV}/` Mongo volume pattern.

Z2M supports this split via the `ZIGBEE2MQTT_CONFIG` env var, which points at the config file independent of the data directory.

### 2.3 New compose service

Append to `docker-compose.yaml`:

```yaml
zigbee2mqtt:
    image: koenkk/zigbee2mqtt:latest
    container_name: zigbee2mqtt
    restart: unless-stopped
    volumes:
        - ./configs/zigbee2mqtt:/app/config:ro # configuration.yaml + secret.yaml
        - ./data/zigbee2mqtt:/app/data # database.db, logs, coordinator backup
        - /run/udev:/run/udev:ro
    devices:
        - /dev/serial/by-id/usb-Silicon_Labs_<...>-if00-port0:/dev/ttyACM0
    environment:
        - TZ=Europe/Amsterdam
        - ZIGBEE2MQTT_CONFIG=/app/config/configuration.yaml
    depends_on:
        - mqtt-broker
    networks:
        - smarthome-network
    # Frontend on host:8080 — optional, useful for pairing/diagnostics
    ports:
        - '8080:8080'
```

Note: the existing `smarthome-hub` service uses `network_mode: host`; the new service uses `smarthome-network` so it can resolve `mqtt-broker` by hostname like the other bridged services. The hub already reaches the broker through localhost since it shares host networking — both work.

### 2.4 Z2M configuration

Create `configs/zigbee2mqtt/configuration.yaml`:

```yaml
homeassistant: false
permit_join: false # Pair on demand via API, never leave open.
mqtt:
    base_topic: zigbee2mqtt
    server: mqtt://mqtt-broker:1885
    user: zigbee2mqtt
    password: '!secret mqtt_password'
serial:
    adapter: ember # EmberZNet (Silicon Labs)
    port: /dev/ttyACM0
advanced:
    log_level: info
    channel: 15 # Avoid Wi-Fi channels 1/6/11 overlap; pick after a scan.
    network_key: GENERATE # On first start Z2M writes a key here. Back it up.
    pan_id: GENERATE
    ext_pan_id: GENERATE
frontend:
    port: 8080
```

Store `mqtt_password` in `data/zigbee2mqtt/secret.yaml` and reference with `!secret`. The `network_key` should be backed up — losing it means re-pairing every device.

Add an npm script for parity with the existing ones:

```json
"zigbee:start": "docker compose up -d zigbee2mqtt",
"zigbee:restart": "docker compose up -d zigbee2mqtt --force-recreate",
```

---

## 3. Hub-side integration

The hub already speaks MQTT (`MqttService`, `MqttController`, `mqttProviders`). Reuse that client; do **not** open a second connection.

### 3.1 New device brand and type

`src/devices/interfaces/common.interface.ts`:

```ts
export enum DeviceBrand {
    Google = 'google',
    Shelly = 'shelly',
    Tuya = 'tuya',
    ESP32 = 'esp32',
    Zigbee = 'zigbee', // NEW
}
```

Zigbee covers a wide product space (bulbs, plugs, sensors, switches, contact/leak/motion). Rather than adding one `DeviceType` per Zigbee product class, **reuse existing types** (`LED`, `Plug`, `MotionSensor`, etc.) and add new ones only when a device truly doesn't fit (e.g. `ContactSensor`, `TemperatureSensor`, `Switch`). Track these as we onboard real devices — don't speculate.

### 3.2 Persisted fields

Add to `DeviceSchema` (`src/devices/schemas/device.schema.ts`) and `Device` interface:

- `zigbeeFriendlyName: string` — the Z2M friendly name, used as the MQTT topic suffix. Required when `brand === Zigbee`. Indexed for fast lookup on incoming state messages.
- `zigbeeIeeeAddress: string` — the 64-bit IEEE address (e.g. `0x00158d0001234567`). Required when `brand === Zigbee`. Stable across renames; useful as the canonical key.
- `zigbeeModelId: string` (optional) — Z2M-reported model, e.g. `TS0601`. Helps the factory decide which sub-service to instantiate when we grow Zigbee-specific subclasses (mirrors how `Esp32ControlServiceFactory` switches on `DeviceType`).

Mirror the validation pattern used for Tuya fields (`required: function () { return this.brand === DeviceBrand.Zigbee; }`).

### 3.3 New devices-control provider

Create `src/devices-control/providers/zigbee/`:

```
zigbee/
├── index.ts
├── zigbee-control-service.factory.ts
├── zigbee-control.service.ts
├── zigbee-controls.dto.ts
```

**`ZigbeeControlServiceFactory`** — implements `DeviceControlServiceFactory`:

- `eligible(device)`: `device.brand === DeviceBrand.Zigbee`.
- `createService(device)`: returns a `ZigbeeControlService`. Later, switch on `device.type` or `device.zigbeeModelId` to return specialized services (e.g. an RGB bulb service that maps brightness/colour, a curtain service for `state: OPEN/CLOSE/STOP`).

**`ZigbeeControlService`** — extends `DevicesControlService`. `setDeviceControls` publishes to `zigbee2mqtt/<friendlyName>/set` via `MqttService`. Payload mapping per Z2M:

- `on` → `{ state: 'ON' | 'OFF' }`
- `brightness` (0–100 in our model) → `{ brightness: 0..254 }` (scale)
- `color` (hex) → `{ color: { hex: '#RRGGBB' } }`
- For specific clusters (curtains, locks, etc.), introduce a subclass rather than special-casing.

**`ZigbeeControlsDto`** — extends `DeviceControlsDto` with optional `brightness`, `color`, etc., validated the same way `TuyaControlsDto` is.

### 3.4 Wire the factory in

Update `src/devices-control/providers/index.ts` to re-export `./zigbee`. Update `devices-control.module.ts` and `devices-control.providers.ts` to register `ZigbeeControlServiceFactory` in `providers:` and in the `inject:` array of the `DEVICES_CONTROL_FACTORY_PROVIDER` factory. This is exactly the pattern `Esp32ControlServiceFactory` already follows.

### 3.5 Extend `MqttService`

Add a Zigbee-aware publish helper to keep topic knowledge in one place:

```ts
// src/mqtt/mqtt.service.ts
async publishZigbeeCommand(friendlyName: string, payload: object): Promise<void> {
    this.client.emit(`zigbee2mqtt/${friendlyName}/set`, payload);
}
```

Add the topic constants to `src/mqtt/mqtt.constants.ts`:

```ts
export const Z2M_MQTT_BASE_TOPIC = 'zigbee2mqtt';
export const ZIGBEE_DEVICE_STATE_TOPIC = 'zigbee2mqtt/+'; // friendly_name
export const ZIGBEE_DEVICE_COMMAND_TOPIC = 'zigbee2mqtt/+/set';
export const ZIGBEE_BRIDGE_DEVICES_TOPIC = 'zigbee2mqtt/bridge/devices';
export const ZIGBEE_BRIDGE_EVENT_TOPIC = 'zigbee2mqtt/bridge/event';
export const ZIGBEE_BRIDGE_LOG_TOPIC = 'zigbee2mqtt/bridge/log';
export const ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC = 'zigbee2mqtt/bridge/request/permit_join';
```

### 3.6 Inbound state — extend `MqttController`

Z2M publishes the full device state as JSON on `zigbee2mqtt/<friendlyName>` whenever it changes. We need a handler:

```ts
@MessagePattern('zigbee2mqtt/+')
async onZigbeeDeviceState(@Ctx() context: MqttContext, @Payload() state: Record<string, unknown>) {
    const friendlyName = this.extractTopicWildcards('zigbee2mqtt/+', context.getTopic())[0];
    if (friendlyName.startsWith('bridge')) return; // bridge/* are control-plane messages
    // Look up device by zigbeeFriendlyName; split state into controls vs measurements.
    // controls: state(on/off), brightness, color, color_temp
    // measurements: battery, linkquality, temperature, humidity, occupancy, contact, ...
}
```

Implementation notes:

- **Wildcard `+` matches `bridge` too.** Guard explicitly, or register `zigbee2mqtt/bridge/#` first and have a separate handler. NestJS MQTT dispatches by exact pattern match, so a clean split is two handlers.
- **Controls vs measurements split** is the main semantic question. Z2M doesn't distinguish — everything is one JSON blob. Introduce a small mapper, keyed by `zigbeeModelId` or `device.type`, that returns `{ controls, measurements }`. Default mapper covers common keys (`state`, `brightness`, `color`, `color_temp` → controls; `battery`, `linkquality`, `temperature`, `humidity`, `pressure`, `occupancy`, `contact`, `tamper` → measurements).
- Reuse the existing `DevicesService.updateDevice(id, new UpdateDeviceDto({ controls, measurements }))` so the existing `controls-updated` / `measurements-updated` events fire and scenarios react automatically. **This is the biggest payoff of integrating into the existing model** — scenarios work for Zigbee devices for free.

### 3.7 Pairing flow

The current pairing flow (`DEVICE_PAIR_REQUEST_TOPIC_NAME`) is ESP32-specific: the device announces itself. Zigbee pairing is different — the coordinator decides when to accept joins. Two endpoints to add on `DevicesController`:

- `POST /devices/zigbee/permit-join` — body `{ enable: boolean, seconds?: number }`. Publishes to `zigbee2mqtt/bridge/request/permit_join`.
- `POST /devices/zigbee/rename` — body `{ ieeeAddress, friendlyName }`. Publishes to `zigbee2mqtt/bridge/request/device/rename`. Useful because Z2M's default friendly name is the IEEE address.

Add a controller method subscribed to `zigbee2mqtt/bridge/event` to react to `device_joined` / `device_interview` events: when interview completes successfully, auto-create a `Device` row with `brand: Zigbee` populated from `bridge/devices` snapshot. Mark the row as `pending` (a new field, optional) until the user assigns a name/room via the existing devices API.

Alternative: don't auto-create. Instead, list "unassigned" Zigbee devices (those present in `bridge/devices` but not in Mongo) via a new endpoint. Less magical, easier to debug. **Recommend this path** for the first cut — auto-creation is easy to add later and hard to undo if it gets noisy.

### 3.8 Removal

Mirror permit-join with a deletion endpoint: `DELETE /devices/:id` for Zigbee devices should also publish to `zigbee2mqtt/bridge/request/device/remove` so the coordinator forgets the node. Otherwise the device stays paired in Z2M's database and re-announces on the next state change.

---

## 4. Scenarios

Scenarios already operate on `device.controls` and `device.measurements` regardless of brand. Once `ZigbeeControlService.setDeviceControls` and the `MqttController` inbound handler are wired in, scenarios such as "turn on the Zigbee bulb when motion is detected on the ESP32 sensor" should work without any scenario-engine changes.

Sanity-check this by tracing one scenario: trigger fires → `DevicesControlServiceFactory.getControlService(device)` → returns `ZigbeeControlService` → `setControls` → MQTT publish → Z2M → bulb. No new code paths in `ScenariosExecutionService`.

---

## 5. Environment variables

Add to `.env`:

```
Z2M_MQTT_BASE_TOPIC=zigbee2mqtt
Z2M_MQTT_USERNAME=zigbee2mqtt
Z2M_MQTT_PASSWORD=<generated>
```

The hub only reads `Z2M_MQTT_BASE_TOPIC` (so the prefix isn't hard-coded). The username/password are consumed by Z2M's config, not by the hub.

---

## 6. Tests

Unit tests, mirroring the existing `*.spec.ts` next to each service:

- `zigbee-control-service.factory.spec.ts` — `eligible()` and `createService()` for varied `(brand, type)` pairs.
- `zigbee-control.service.spec.ts` — verify `setDeviceControls` calls `MqttService` with the correct topic and payload mapping (on/off, brightness scaling, hex colour).
- Extend `mqtt.controller.spec.ts` — feed a `zigbee2mqtt/<friendlyName>` payload and assert `devicesService.updateDevice` is called with the right `controls` / `measurements` split.
- Add a parser test that exercises the controls/measurements mapper across a handful of real Z2M payload shapes (bulb, plug-with-power-meter, contact sensor, motion sensor).

No integration test against a real broker — keep it consistent with the existing approach.

---

## 7. Rollout order

Each step leaves the system working and reversible:

1. Flash dongle to EmberZNet; verify under `/dev/serial/by-id`.
2. Add Z2M to `docker-compose.yaml`, add the MQTT user; bring it up; confirm `zigbee2mqtt/bridge/state` shows `online` via `mosquitto_sub -t 'zigbee2mqtt/#' -v`.
3. Pair **one** test device (e.g. a cheap plug) using the Z2M frontend at `:8080`. Confirm state messages flow.
4. Add `DeviceBrand.Zigbee`, schema fields, and migration notes. No behaviour change yet.
5. Add `ZigbeeControlServiceFactory` + `ZigbeeControlService` + DTO; register in module. Manually create a device row pointing at the test plug. Issue a control change via the hub's REST API and confirm the plug toggles.
6. Extend `MqttController` with the inbound handler + controls/measurements mapper. Confirm device state in Mongo reflects reality.
7. Add the `permit-join`, `rename`, and pairing/removal endpoints.
8. Write one scenario that uses a Zigbee device as either trigger or action; verify end-to-end.

---

## 8. Risks and open questions

- **Dongle Lite limitations.** 768 KB flash, no Thread coexistence with Zigbee in practice. Fine for ~20–30 routers/end-devices but not for large meshes. If the network grows past that, the migration path is the Dongle Plus (no code changes; reflash + re-pair).
- **Topic conflict.** If anything else publishes under `zigbee2mqtt/#` on the broker we'll get phantom devices. Mosquitto ACLs eliminate this; defer until we see misbehaviour.
- **Friendly-name renames** invalidate the persisted topic. The IEEE address is the stable key — always look devices up by `zigbeeIeeeAddress` and treat `zigbeeFriendlyName` as a refreshable label. Re-sync friendly names from `zigbee2mqtt/bridge/devices` on hub startup.
- **Z2M version pinning.** `koenkk/zigbee2mqtt:latest` is convenient but auto-updated by watchtower (the compose file has watchtower enabled for labelled images). Pin a tag (`:2.x.y`) or omit the watchtower label, since Z2M minor versions occasionally change MQTT payload shapes for specific devices.
- **Controls/measurements mapper coverage.** The default mapper will miss exotic device attributes. Plan to iterate: log unknown keys at `warn` level so we see what's being ignored without it being noisy.
