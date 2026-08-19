# Documentation

## API Documentation

### Swagger

Interactive API documentation is available via Swagger UI when the server is running:

- **Endpoint**: `/api`
- **URL**: `http://localhost:3000/api` (default local server)

The Swagger documentation includes all REST endpoints for:

- User authentication (login/register)
- Device management (CRUD operations)
- Device control (turn on/off, set brightness, etc.)
- Scenario management (automation rules)

### Postman Collection

A Postman collection with pre-configured API requests is available in the `/api` directory:

- File: [`my-home-hub.postman_collection.json`](../api/my-home-hub.postman_collection.json)

Import this collection into Postman for quick API testing and exploration.

## Configuration

### Environment Setup

The application uses env file `.env`, which can be created from the [`.env.example`](../.env.example):

```shell
cp .env.example .env
```

Configuration is loaded based on the `NODE_ENV` variable.

### Required Services

1. **MongoDB** - Database for storing device states, users, and scenarios
2. **MQTT Broker** - Message broker for ESP32 device communication

See the [MQTT configuration guide](../configs/mqtt/README.md) for MQTT broker setup instructions.

### Environment Variables

| Category     | Variable                       | Description                                                                                                                    |
| ------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Server**   | `PORT`                         | HTTP server port                                                                                                               |
| **Server**   | `NODE_ENV`                     | Environment (`local`, `prod`)                                                                                                  |
| **Server**   | `TZ_LATITUDE`, `TZ_LONGITUDE`  | Location for sunrise/sunset calculations                                                                                       |
| **Server**   | `TRUST_PROXY`                  | Reverse proxy support used to resolve the real client IP (`false`, `true`, a hops count, or a list of trusted proxies/subnets) |
| **Server**   | `LOCAL_NETWORK_ONLY_ENABLED`   | Reject requests to local network only endpoints coming from outside the local network (default enabled)                        |
| **Server**   | `LOCAL_NETWORK_ALLOWED_CIDRS`  | Extra comma-separated addresses/subnets treated as local (e.g. a VPN subnet)                                                   |
| **Auth**     | `JWT_SECRET`                   | Secret key for JWT signing                                                                                                     |
| **Auth**     | `JWT_EXPIRATION_TIMEOUT`       | Token lifetime in seconds                                                                                                      |
| **Auth**     | `PASSWORD_RESET_TOKEN_TTL_SEC` | Password reset token lifetime in seconds                                                                                       |
| **Auth**     | `REGISTRATION_TOTP_SECRET`     | Admin TOTP secret for registration                                                                                             |
| **Auth**     | `USER_PASSWORD_SECRET`         | Argon2 hashing secret                                                                                                          |
| **Auth**     | `USER_PASSWORD_SALT`           | Argon2 hashing salt                                                                                                            |
| **Database** | `MONGO_DOMAIN`                 | MongoDB hostname                                                                                                               |
| **Database** | `MONGO_PORT`                   | MongoDB port                                                                                                                   |
| **Database** | `MONGO_INITDB_DATABASE`        | Database name                                                                                                                  |
| **Database** | `MONGO_INITDB_ROOT_USERNAME`   | MongoDB username                                                                                                               |
| **Database** | `MONGO_INITDB_ROOT_PASSWORD`   | MongoDB password                                                                                                               |
| **MQTT**     | `MQTT_CLIENT_ID`               | MQTT client identifier                                                                                                         |
| **MQTT**     | `MQTT_DOMAIN`                  | MQTT broker hostname                                                                                                           |
| **MQTT**     | `MQTT_PORT`                    | MQTT broker port                                                                                                               |
| **MQTT**     | `MQTT_USERNAME`                | MQTT username                                                                                                                  |
| **MQTT**     | `MQTT_PASSWORD`                | MQTT password                                                                                                                  |

### Local Network Restriction

Some endpoints that do not require authentication are only served to clients from the local network, so that a hub exposed to the internet cannot be abused by strangers (e.g. registration request spam):

| Endpoint                                         | Access                                       |
| ------------------------------------------------ | -------------------------------------------- |
| `POST /auth/register/requests`                   | Local network only                           |
| `GET /auth/register/requests/{externalId}`       | Local network only                           |
| `DELETE /auth/register/requests/{externalId}`    | Local network only                           |
| `GET /info`                                      | Local network only                           |
| Login, token refresh, register, password restore | Public, so that users can authorize remotely |

Requests from outside get a **403 Forbidden**. Loopback, private and link-local IPv4/IPv6 addresses count as local; anything else has to be listed in `LOCAL_NETWORK_ALLOWED_CIDRS` (e.g. `LOCAL_NETWORK_ALLOWED_CIDRS=100.64.0.0/10` for a Tailscale network). The whole restriction can be turned off with `LOCAL_NETWORK_ONLY_ENABLED=false`.

#### Behind a Reverse Proxy

The client address is taken from the connection, unless `TRUST_PROXY` is configured, in which case it is resolved from the `X-Forwarded-For` header. Without it every request looks like it comes from the proxy, which for a proxy running in the same network means the restriction lets everything through.

`TRUST_PROXY=true` trusts the header from any client and lets the client IP be spoofed. Prefer the number of proxies in front of the server (`TRUST_PROXY=1`) or a list of trusted proxies (`TRUST_PROXY=loopback,172.18.0.0/16`). See the [express guide](https://expressjs.com/en/guide/behind-proxies.html) for the supported values.

## Supported Device Brands

The hub supports the following device types:

| Brand      | Protocol  | Description                                                                                                                                                                                             |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ESP32**  | MQTT      | Custom ESP32-based devices communicating via MQTT. See [SmartHomeDevices](https://github.com/IlyaMatsuev/SmartHomeDevices) library for implementing the communication interface on the microcontroller. |
| **Tuya**   | Local API | Tuya smart devices via local network API                                                                                                                                                                |
| **Shelly** | HTTP      | Shelly devices via REST API                                                                                                                                                                             |
| **Google** | Cast      | Google Cast speakers for TTS announcements                                                                                                                                                              |

## Architecture

### Module Overview

- **CommonModule** - Global filters, interceptors, condition evaluation
- **AuthModule** - JWT authentication with TOTP registration
- **UsersModule** - User management with Argon2 password hashing
- **DevicesModule** - Device CRUD, state management
- **DevicesControlModule** - Device communication providers (factory pattern)
- **ScenariosModule** - Automation scenarios with triggers and actions
- **SchedulerModule** - Cron-based scenario scheduling
- **MqttModule** - MQTT broker communication
