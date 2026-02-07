# SmartHome Hub

A NestJS-based SmartHome Hub that controls, stores, and provides information about IoT devices. The hub communicates with devices via multiple protocols (MQTT, Tuya API, HTTP) and provides REST/WebSocket APIs for control and monitoring.

## Features

- **Multi-Protocol Device Support** - Control devices via MQTT, Tuya local API, HTTP, and Google Cast
- **Device Brands** - ESP32 (custom MQTT devices using [SmartHomeDevices](https://github.com/IlyaMatsuev/SmartHomeDevices) library), Tuya, Shelly, Google Speakers
- **Automation Scenarios** - Create automation rules with cron schedules and device state triggers
- **Real-time Updates** - WebSocket gateway for live device state changes
- **Secure Authentication** - JWT-based authentication with TOTP for user registration
- **REST API** - Full device management through REST endpoints with Swagger documentation

## Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker and Docker Compose
- MongoDB 7.0+
- MQTT Broker (Eclipse Mosquitto)

## 🚀 Build & Run

### Install Dependencies

```bash
npm install
```

### Start Infrastructure Services

MongoDB and MQTT broker run as Docker containers managed by Docker Compose.

```bash
# Development - Start MongoDB
npm run mongo:start

# Development - Start MQTT broker
npm run mqtt:start

# Production - Start MongoDB
npm run mongo:start:prod

# Production - Start MQTT broker
npm run mqtt:start:prod
```

### Run the Application

```bash
# Development mode with hot-reload
npm run start:dev

# Local mode
npm run start

# Production mode (via Docker)
npm run start:prod
```

### Build Docker Image

```bash
npm run build:image
```

## 🛠️ Configuration

Configuration is managed through environment files.

### Environment Variables

| Variable                      | Description                          |
| ----------------------------- | ------------------------------------ |
| `PORT`                        | Server port (default: 3000)          |
| `NODE_ENV`                    | Environment name (`local`, `prod`)   |
| `TZ_LATITUDE`, `TZ_LONGITUDE` | Location for sun calculations        |
| `JWT_SECRET`                  | Secret for JWT token signing         |
| `JWT_EXPIRATION_TIMEOUT`      | Token expiration in seconds          |
| `REGISTRATION_TOTP_SECRET`    | TOTP secret for admin registration   |
| `USER_PASSWORD_SECRET`        | Argon2 password hashing secret       |
| `USER_PASSWORD_SALT`          | Argon2 password hashing salt         |
| `DEVICE_ACCESS_KEY`           | Key for device authentication        |
| `LOCAL_NETWORK_AUTH_BYPASS`   | Allow unauthenticated local requests |
| `LOCAL_NETWORK_PATTERN`       | Regex for trusted IP ranges          |
| `MONGO_*`                     | MongoDB connection settings          |
| `MQTT_*`                      | MQTT broker connection settings      |

## 📝 Documentation

- [General project documentation](docs)
- [Postman API collection](api)
- Swagger API documentation available at `/api` endpoint when the server is running

## ❓ Questions

If you have any questions you can start a discussion.
If you think something works not as expected or you want to request a new feature, you can create an issue with the appropriate template selected.

## 🤝 Contributing

Pull requests are welcome.
For major changes, please open an issue first to discuss what you would like to change.
Please make sure to update tests as appropriate.

## 🎫 License

[MIT](LICENSE)
