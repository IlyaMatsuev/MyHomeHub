# My Home Hub

[![Validation](https://github.com/IlyaMatsuev/MySmartHome/actions/workflows/validation.yaml/badge.svg)](https://github.com/IlyaMatsuev/MySmartHome/actions/workflows/validation.yaml)
[![Publish Package](https://github.com/IlyaMatsuev/MySmartHome/actions/workflows/publish.yaml/badge.svg)](https://github.com/IlyaMatsuev/MySmartHome/actions/workflows/publish.yaml)

A home-running server that controls, stores, and provides information about IoT devices and other home services. The hub communicates with devices via multiple protocols (MQTT, Tuya API, HTTP) and provides a REST API for control and monitoring.

![My Home Banner](./public/banner.png)

## Overview

- **Multi-Protocol Device Support**: Control devices via MQTT, Tuya local API, HTTP, and Google Cast
- **Device Brands**: ESP32 (custom MQTT devices using [SmartHomeDevices](https://github.com/IlyaMatsuev/SmartHomeDevices) library), Tuya, Shelly, Google Speakers
- **Automation Scenarios**: Create automation rules with cron schedules and device state triggers
- **Secure Authentication**: JWT-based authentication with TOTP for user registration and Google sign-in support
- **REST API**: Full device management through REST endpoints with Swagger documentation
- **Discoverable**: The hub can be discovered in the Wi-Fi network by sending a UDP request

## Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker and Docker Compose

## 🚀 Build & Run

1. Install Dependencies: `npm install`
2. Start Infrastructure Services
    - Start MongoDB (via Docker): `npm run mongo:start`
    - Start MQTT broker (via Docker): `npm run mqtt:start`

3. Start the Application
    - Start in development mode with hot-reload: `npm run start:dev`
    - Start in production mode (via Docker): `npm run start`

4. Run all unit tests: `npm test`

## 🛠️ Configuration

The application uses env file `.env`, which can be created from the [`.env.example`](../.env.example): `cp .env.example .env`

### Google Sign-In

Optional. Leave `GOOGLE_CLIENT_ID` empty and the `/auth/google/*` endpoints respond with **503** - everything else keeps working.

The hub does not run the OAuth redirect flow. The client app performs the Google Sign-In itself and posts the resulting
**ID token**, which the hub verifies against the client IDs below. There is no client secret and no redirect URI to register,
which is what makes this practical for a self-hosted server with no stable public address.

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a project and configure the OAuth consent screen.
   Only the `openid`, `email` and `profile` scopes are used - these are non-sensitive, so no app verification is needed.
2. Under **Credentials → Create OAuth client ID**, create one client per platform you ship:
    - **Web application** - set _Authorized JavaScript origins_ to the origin serving the web app. No redirect URI is needed.
    - **iOS** - the bundle ID is enough, there is no secret.
3. Put every client ID into `GOOGLE_CLIENT_ID`, comma-separated:

    ```dotenv
    GOOGLE_CLIENT_ID=123-web.apps.googleusercontent.com,456-ios.apps.googleusercontent.com
    ```

Signing in with Google follows the same approval policy as the regular registration: a brand new account is only created when
its email already has an **approved registration request**. An existing user with the same email is linked automatically, since
Google has verified the email ownership.

> **Note on browser clients:** Google rejects raw IP addresses as authorized JavaScript origins, and requires `https` for
> everything except `http://localhost`. A hub reachable only as `http://192.168.x.x:3000` therefore cannot serve a web client
> that signs in with Google - use a real domain with a certificate (a LAN address behind split-horizon DNS works), or
> `http://localhost` during development. Remember to add the web app's origin to `CORS_ORIGINS` as well.

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
