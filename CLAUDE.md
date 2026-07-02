# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start in development mode (with watch)
npm run start:dev

# Start in local mode
npm run start

# Start in production (via Docker)
npm run start:prod

# Lint code
npm run eslint:verify

# Fix lint issues
npm run eslint

# Format code
npm run prettier

# Verify formatting
npm run prettier:verify

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Infrastructure Commands

```bash
# Start MongoDB locally
npm run mongo:start

# Start MQTT broker locally
npm run mqtt:start

# Build Docker image
npm run build:image
```

## Architecture Overview

This is a **NestJS-based server** that controls IoT devices via multiple protocols (MQTT, Tuya API, HTTP). The hub stores device states in MongoDB and provides a REST API for control.

### Module Structure

```
AppModule
├── CommonModule          # Global filters, interceptors, ConditionsEvaluatorService
├── AuthModule            # Passport.js JWT auth (login/refresh/register with TOTP), role-based access
├── UsersModule           # User management with Argon2 password hashing
├── DevicesModule         # Device CRUD, state management
│   └── DevicesControlModule  # Device communication providers
├── DeviceConfigsModule   # YAML-defined commands/controls/measurements metadata synced to MongoDB
├── ScenariosModule       # Automation scenarios with triggers and actions
│   └── SchedulerModule   # Cron-based scenario scheduling
├── MqttModule            # MQTT broker communication
├── DiscoveryModule       # UDP broadcast discovery and GET /info endpoint
└── ThrottlerModule       # Rate limiting with Redis storage (short/medium/long tiers)
```

### Device Control Architecture

The `DevicesControlModule` uses a factory pattern to support multiple device brands:

- **TuyaControlServiceFactory** - Tuya smart devices via local API
- **ShellyControlServiceFactory** - Shelly devices via HTTP
- **GoogleSpeakerControlServiceFactory** - Google Cast speakers
- **Esp32ControlServiceFactory** - Custom ESP32 devices via MQTT

Each device has:

- `controls` - Writable state (on/off, brightness, color)
- `measurements` - Read-only state (temperature, power consumption)

### Scenario System

Scenarios define automation rules with:

- **Triggers**: Cron schedules or device state changes
- **Logic**: Conditions evaluated by `ConditionsEvaluatorService`
- **Actions**: Set device controls/measurements

### Authentication & Authorization

Authentication uses **Passport.js** with a `passport-jwt` strategy (`src/auth/strategies/jwt.strategy.ts`):

- `POST /auth/login` accepts either email/password **or** a `refreshToken` (providing both returns 400). It responds with a short-lived `accessToken` and a longer-lived `refreshToken`, allowing token renewal without re-entering credentials.
- Two global guards run in order: `JwtAuthGuard` (validates the access token, honoring `@Public()` and the local-auth bypass) then `RolesGuard` (enforces `@Roles(...)`).

Users and registration requests carry a `role` (`UserRole`: `Admin`, `Resident`, `Guest`):

- **Admin** - full access (bypasses all `@Roles` checks). Assigned automatically on TOTP registration.
- **Resident** - manages devices and scenarios (`@Roles(UserRole.Resident)` on those controllers).
- **Guest** - default role for new registration requests; limited access.

Restrict endpoints with `@Roles(...)` from `auth/decorators`. Endpoints without `@Roles` are open to any authenticated user. Admins can assign the role granted on approval via the `role` field of `PUT /auth/register/requests/{externalId}`; the new user inherits the registration request's role.

### Path Aliases (tsconfig.json)

```
devices/*       → src/devices/*
devices-control/* → src/devices-control/*
device-configs/* → src/device-configs/*
scenarios/*     → src/scenarios/*
users/*         → src/users/*
auth/*          → src/auth/*
mqtt/*          → src/mqtt/*
common/*        → src/common/*
scheduler/*     → src/scheduler/*
db/*            → src/db/*
discovery/*     → src/discovery/*
throttler/*     → src/throttler/*
```

## Environment Configuration

Environment file: `.env`

Key variables:

- `SERVER_LABEL` - Human-readable server name (used in Swagger and discovery)
- `PORT`, `TZ_LATITUDE`, `TZ_LONGITUDE` - Server config
- `UDP_PORT`, `DISCOVERY_MESSAGE` - UDP broadcast discovery settings
- `JWT_SECRET`, `JWT_EXPIRATION_TIMEOUT` - Access token signing secret and lifetime
- `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRATION_TIMEOUT` - Refresh token signing secret and lifetime
- `REGISTRATION_TOTP_SECRET` - Admin TOTP for user registration
- `USER_PASSWORD_SECRET`, `USER_PASSWORD_SALT` - Argon2 hashing
- `MONGO_*` - MongoDB connection
- `MQTT_*` - MQTT broker connection
- `REDIS_*` - Redis connection (for rate limiting)
- `THROTTLE_*` - Rate limiting configuration (enabled, TTL/limit for short/medium/long tiers)
- `TRUST_PROXY` - Enable proxy support to rate limit by real client IP
- `DEVICE_CONFIGS_DIR` - Directory with YAML device config files (default `configs/devices`)

### Device Configs

Per-brand YAML files under `configs/devices/<brand>.yaml` declare the metadata (label, type, description, value mappings) for the commands/controls/measurements that the UI can display per device. `DeviceConfigsService` reads the directory on startup and on file changes, then upserts one MongoDB document per `(brand, type, transportProtocol)` combination — stale documents not present in YAML are removed.

## Code Style

- 4-space indentation for TypeScript
- Single quotes, trailing commas
- Max function params: 3
- Max nesting depth: 5
- No console.log (only console.warn/error)
- Camelcase enforced
- Curly braces required

## Capturing Corrections

When the user corrects the way you act — points out a mistake, rejects an approach, or teaches a rule they want followed from now on — after fixing the immediate problem, also update the instruction file that would have prevented the mistake, so the lesson sticks for future sessions. Do this without being asked.

Pick the narrowest file that covers the rule:

- Role-specific guidance (how the Tester writes tests, how the Architect plans, etc.) → the matching file under `.claude/agents/*.md`
- Repo-wide guidance (conventions, commands, architecture, workflow rules) → this `CLAUDE.md`

When writing the update, include **why** (the concrete mistake or reasoning) alongside the rule, so future-you can judge edge cases instead of following it blindly. Skip this step for one-off stylistic nits or purely local fixes that aren't generalizable — only capture corrections that would apply again.
