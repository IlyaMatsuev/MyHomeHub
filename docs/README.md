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

- File: [`smarthome-hub.postman_collection.json`](../api/smarthome-hub.postman_collection.json)

Import this collection into Postman for quick API testing and exploration.

## Configuration

### Environment Setup

The application uses environment-specific configuration files:

- `.env.local` - Development environment
- `.env.prod` - Production environment

Configuration is loaded based on the `NODE_ENV` variable.

### Required Services

1. **MongoDB** - Database for storing device states, users, and scenarios
2. **MQTT Broker** - Message broker for ESP32 device communication

See the [MQTT configuration guide](../configs/mqtt/README.md) for MQTT broker setup instructions.

### Environment Variables

| Category     | Variable                      | Description                              |
| ------------ | ----------------------------- | ---------------------------------------- |
| **Server**   | `PORT`                        | HTTP server port                         |
| **Server**   | `NODE_ENV`                    | Environment (`local`, `prod`)            |
| **Server**   | `TZ_LATITUDE`, `TZ_LONGITUDE` | Location for sunrise/sunset calculations |
| **Auth**     | `JWT_SECRET`                  | Secret key for JWT signing               |
| **Auth**     | `JWT_EXPIRATION_TIMEOUT`      | Token lifetime in seconds                |
| **Auth**     | `REGISTRATION_TOTP_SECRET`    | Admin TOTP secret for registration       |
| **Auth**     | `USER_PASSWORD_SECRET`        | Argon2 hashing secret                    |
| **Auth**     | `USER_PASSWORD_SALT`          | Argon2 hashing salt                      |
| **Auth**     | `DEVICE_ACCESS_KEY`           | Device authentication key                |
| **Auth**     | `LOCAL_NETWORK_AUTH_BYPASS`   | Skip auth for local IPs                  |
| **Auth**     | `LOCAL_NETWORK_PATTERN`       | Trusted IP regex pattern                 |
| **Database** | `MONGO_DOMAIN`                | MongoDB hostname                         |
| **Database** | `MONGO_PORT`                  | MongoDB port                             |
| **Database** | `MONGO_INITDB_DATABASE`       | Database name                            |
| **Database** | `MONGO_INITDB_ROOT_USERNAME`  | MongoDB username                         |
| **Database** | `MONGO_INITDB_ROOT_PASSWORD`  | MongoDB password                         |
| **MQTT**     | `MQTT_CLIENT_ID`              | MQTT client identifier                   |
| **MQTT**     | `MQTT_DOMAIN`                 | MQTT broker hostname                     |
| **MQTT**     | `MQTT_PORT`                   | MQTT broker port                         |
| **MQTT**     | `MQTT_USERNAME`               | MQTT username                            |
| **MQTT**     | `MQTT_PASSWORD`               | MQTT password                            |

## Supported Device Brands

The hub supports the following device types:

| Brand      | Protocol  | Description                                       |
| ---------- | --------- | ------------------------------------------------- |
| **ESP32**  | MQTT      | Custom ESP32-based devices communicating via MQTT |
| **Tuya**   | Local API | Tuya smart devices via local network API          |
| **Shelly** | HTTP      | Shelly devices via REST API                       |
| **Google** | Cast      | Google Cast speakers for TTS announcements        |

## Architecture

### Module Overview

- **CommonModule** - Global filters, interceptors, condition evaluation
- **AuthModule** - JWT authentication with TOTP registration
- **UsersModule** - User management with Argon2 password hashing
- **DevicesModule** - Device CRUD, WebSocket gateway, state management
- **DevicesControlModule** - Device communication providers (factory pattern)
- **ScenariosModule** - Automation scenarios with triggers and actions
- **SchedulerModule** - Cron-based scenario scheduling
- **MqttModule** - MQTT broker communication
