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

This is a **NestJS-based SmartHome Hub** that controls IoT devices via multiple protocols (MQTT, Tuya API, HTTP). The hub stores device states in MongoDB and provides a REST API for control.

### Module Structure

```
AppModule
├── CommonModule          # Global filters, interceptors, ConditionsEvaluatorService
├── AuthModule            # JWT authentication (login/register with TOTP)
├── UsersModule           # User management with Argon2 password hashing
├── DevicesModule         # Device CRUD, state management
│   └── DevicesControlModule  # Device communication providers
├── ScenariosModule       # Automation scenarios with triggers and actions
│   └── SchedulerModule   # Cron-based scenario scheduling
└── MqttModule            # MQTT broker communication
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

### Path Aliases (tsconfig.json)

```
devices/*       → src/devices/*
devices-control/* → src/devices-control/*
scenarios/*     → src/scenarios/*
users/*         → src/users/*
auth/*          → src/auth/*
mqtt/*          → src/mqtt/*
common/*        → src/common/*
scheduler/*     → src/scheduler/*
db/*            → src/db/*
```

## Environment Configuration

Environment file: `.env`

Key variables:

- `PORT`, `TZ_LATITUDE`, `TZ_LONGITUDE` - Server config
- `JWT_SECRET`, `JWT_EXPIRATION_TIMEOUT` - Auth tokens
- `REGISTRATION_TOTP_SECRET` - Admin TOTP for user registration
- `USER_PASSWORD_SECRET`, `USER_PASSWORD_SALT` - Argon2 hashing
- `MONGO_*` - MongoDB connection
- `MQTT_*` - MQTT broker connection

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
