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
├── AuthModule            # Passport.js JWT auth (login/refresh/register with TOTP), Google sign-in, role-based access
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
- `POST /auth/password/reset` accepts `email` and `totp` (admin's authenticator TOTP — same secret used for TOTP registration) and returns a short-lived `resetToken`
- `PUT /auth/password/change` accepts the `resetToken` and `newPassword`, rehashes it, and updates the user record. The password reset token is an opaque single-use random value (issued by `PasswordResetTokensService`), stored in Redis as a SHA-256-hashed key with `PASSWORD_RESET_TOKEN_TTL_SEC` TTL, and atomically consumed via `GETDEL` on use — it is not a JWT and shares no signing material with access/refresh tokens.
- `PUT /auth/google/login` accepts a Google `idToken` and responds with the same `accessToken`/`refreshToken` pair as the credentials login
- `POST /auth/google/link` and `DELETE /auth/google/link` link/unlink a Google account for the currently authenticated user
- Three global guards run in order: `LocalNetworkGuard` (enforces `@Public({ localOnly: true })`), `JwtAuthGuard` (validates the access token, honoring `@Public()` and the local-auth bypass), then `RolesGuard` (enforces `@ForRoles(...)`).

Registration requests (`/auth/register/requests`) have a status lifecycle: `pending` → `approved`/`rejected` (admin via `PUT`) or `cancelled` (requester via the public `DELETE /auth/register/requests/{externalId}`; only `pending` requests can be cancelled). `POST` returns **409 Conflict** (`FieldConflictException` — the 409 twin of `FieldValidationException`) when a `pending`/`approved` request for the email already exists; `rejected` (unless blacklisted) and `cancelled` requests are reset to `pending` by re-submitting via `POST`. Cancelled requests cannot be approved and block `POST /auth/register` until re-requested.

Users and registration requests carry a `role` (`UserRole`: `Admin`, `Resident`, `Guest`):

- **Admin** - full access (bypasses all `@ForRoles` checks). Assigned automatically on TOTP registration.
- **Resident** - manages devices and scenarios (`@ForRoles(UserRole.Resident)` on those controllers).
- **Guest** - default role for new registration requests; limited access.

Restrict endpoints with `@ForRoles(...)` from `auth/decorators`. `RolesGuard` only lets a request through when the user is an `Admin` or their role is listed in `@ForRoles(...)`, so an authenticated non-admin is rejected on an endpoint without the decorator — every non-admin endpoint must list its roles explicitly (e.g. `@ForRoles(UserRole.Resident, UserRole.Guest)` on `GET /users/me`). Admins can assign the role granted on approval via the `role` field of `PUT /auth/register/requests/{externalId}`; the new user inherits the registration request's role.

### Google Sign-In

The hub verifies **Google ID tokens** instead of running the OAuth redirect flow: the client (WEB or IOS app) performs the Google Sign-In itself and posts the resulting `idToken`. A self-hosted hub has no stable public address, so registering an OAuth redirect URI per installation is not practical, and the ID token flow needs no client secret.

`GoogleTokenVerifierService` (`auth/google-token-verifier.service.ts`) validates the token with `google-auth-library` against the client IDs from `GOOGLE_CLIENT_ID` (comma-separated, since Google issues one per platform) and rejects tokens whose email is not verified by Google. Without the variable set the Google endpoints respond with **503**. `GoogleAuthService` (`auth/google-auth.service.ts`) then resolves the user for the verified profile:

1. The user already linked to the Google account (`users.googleId`, a unique sparse index) is signed in.
2. Otherwise a user with the same email is linked to the Google account automatically — Google has verified the email ownership. A user already linked to a _different_ Google account gets a **409 Conflict**.
3. Otherwise a new user is registered, but only when the email has an **approved registration request** — the Google sign-up follows the same approval policy as the credentials one (`RegistrationRequestsService.getApprovedRequestByEmail`, shared by both flows).

Users registered through Google have **no password** (`users.password` is only required when there is no `googleId`), so `PUT /auth/login` rejects them and `DELETE /auth/google/link` refuses to unlink until a password is set via the password reset flow. `GET /users/me` exposes `googleLinked`, `googleEmail` and `hasPassword` so a client can tell how the account can be authenticated.

### Local Network Restriction

Endpoints marked with `@Public({ localOnly: true })` (from `auth/decorators`) are rejected with **403 Forbidden** unless the request originates from the local network. This exists so a hub exposed to the internet cannot have its unauthenticated endpoints abused (e.g. registration request spam). `localOnly` defaults to `false`, so a bare `@Public()` stays reachable from anywhere. The restriction is always enforced — there is no env variable to turn it off.

Currently applied to `GET/POST/DELETE /auth/register/requests` (the public ones) and `GET /info`. The login, refresh, register and password restore endpoints stay reachable from anywhere so users can authorize remotely.

`LocalNetworkGuard` (`auth/guards`) does the address matching with `ipaddr.js` by checking the address range against `LOCAL_IP_RANGES` (`auth/auth.constants`): IPv4 loopback/private/link-local, IPv6 loopback/unique-local/link-local. IPv4-mapped IPv6 addresses are unwrapped before matching, and an unresolvable address fails closed.

The client IP comes from `request.ip`, which honors the express `trust proxy` setting, so the restriction works behind a reverse proxy. `TRUST_PROXY` accepts `false`, `true`, a number of proxy hops, or a comma-separated list of trusted proxies/subnets — `true` trusts `X-Forwarded-For` from any client and therefore allows spoofing the client IP, so a hop count or a proxy list should be preferred (the server logs a warning on startup when `TRUST_PROXY=true`).

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
- `PASSWORD_RESET_TOKEN_TTL_SEC` - Password reset token lifetime in seconds (opaque Redis-backed token)
- `GOOGLE_CLIENT_ID` - Comma-separated Google client IDs the Google ID tokens are verified against (empty disables the Google endpoints)
- `REGISTRATION_TOTP_SECRET` - Admin TOTP for user registration and password restore
- `USER_PASSWORD_SECRET`, `USER_PASSWORD_SALT` - Argon2 hashing
- `MONGO_*` - MongoDB connection
- `MQTT_*` - MQTT broker connection
- `REDIS_*` - Redis connection (for rate limiting)
- `THROTTLE_*` - Rate limiting configuration (enabled, TTL/limit for short/medium/long tiers)
- `TRUST_PROXY` - Reverse proxy support used to resolve the real client IP (`false`, `true`, a hops count, or a list of trusted proxies/subnets)
- `DEVICE_CONFIGS_DIR` - Directory with YAML device config files (default `configs/devices`)

### Device Configs

Per-brand YAML files under `configs/devices/<brand>.yaml` declare the metadata (label, type, description, value mappings) for the commands/controls/measurements that the UI can display per device. `DeviceConfigsService` reads the directory on startup and on file changes, then upserts one MongoDB document per `(brand, type, transportProtocol)` combination — stale documents not present in YAML are removed.

Device configs are consumed in three places:

- **Device GET endpoints** (`GET /devices`, `GET /devices/{externalId}`) accept an `includeConfig=true` query parameter. When set, each device response includes a `config` field with the matching config's non-empty `commands`/`controls`/`measurements` sections (omitted entirely when nothing matches).
- **Outgoing payloads**: `DevicesControlService.setControls` passes the transport message payload through `DeviceConfigsMapperService.mapPayloadToDevice`, translating internal command/control names and values to the device-side ones declared via the config `path` fields. Names not present in the config are sent as-is.
- **Incoming payloads**: ESP32 MQTT controls/measurements updates are translated back to internal names via `DeviceConfigsMapperService.mapPayloadFromDevice` (unknown fields kept), and Zigbee (zigbee2mqtt) state updates are categorized into commands/controls/measurements via `splitPayloadFromDevice` (fields not declared in the config are dropped).

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
