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
├── DiscoveryModule       # mDNS (Bonjour/DNS-SD) advertisement and GET /info endpoint
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

### Device Payloads

`controls` and `measurements` updates are **merged** into the stored payload, not replaced: an update carrying a single field leaves the rest of the stored fields intact. This matters for devices that report deltas rather than full state. Send `$override: true` alongside the payload to replace the stored one instead; the flag itself is stripped and never persisted.

Both payload kinds are validated before the device document is saved, so an invalid payload rejects the whole update. `DevicesControlService.mergeValidateControls`/`mergeValidateMeasurements` do the merge and hand the result to the DTO returned by `getControlsDtoType()`/`getMeasurementsDtoType()` - the controls DTO is per brand/type (e.g. `ShellyLedControlsDto`), while measurements default to the generic `DevicePayloadDto` until a brand overrides `getMeasurementsDtoType()`.

### Scenario System

Scenarios define automation rules with:

- **Triggers**: Cron schedules or device state changes
- **Logic**: Conditions evaluated by `ConditionsEvaluatorService`
- **Actions**: The `actions` array (`ScenarioAction`) - each entry names a device by `externalId` and the controls/measurements to `set` on it when the scenario executes.

### Authentication & Authorization

Authentication uses **Passport.js** with a `passport-jwt` strategy (`src/auth/strategies/jwt.strategy.ts`):

- `POST /auth/login` accepts either email/password **or** a `refreshToken` (providing both returns 400). It responds with a short-lived `accessToken` and a longer-lived `refreshToken`, allowing token renewal without re-entering credentials.
- `POST /auth/password/reset` accepts `email` and `totp` (admin's authenticator TOTP - same secret used for TOTP registration) and returns a short-lived `resetToken`
- `PUT /auth/password/change` accepts the `resetToken` and `newPassword`, rehashes it, and updates the user record. The password reset token is an opaque single-use random value (issued by `PasswordResetTokensService`), stored in Redis as a SHA-256-hashed key with `PASSWORD_RESET_TOKEN_TTL_SEC` TTL, and atomically consumed via `GETDEL` on use - it is not a JWT and shares no signing material with access/refresh tokens.
- `PUT /auth/google/login` accepts a Google `idToken` and responds with the same `accessToken`/`refreshToken` pair as the credentials login
- `POST /auth/google/link` and `DELETE /auth/google/link` link/unlink a Google account for the currently authenticated user
- Three global guards run in order: `LocalNetworkGuard` (enforces `@Public({ localOnly: true })`), `JwtAuthGuard` (validates the access token, honoring `@Public()` and the local-auth bypass), then `RolesGuard` (enforces `@ForRoles(...)`).

Registration requests (`/auth/register/requests`) have a status lifecycle: `pending` → `approved`/`rejected` (admin via `PUT`) or `cancelled` (requester via the public `DELETE /auth/register/requests/{externalId}`; only `pending` requests can be cancelled). `POST` returns **409 Conflict** (`FieldConflictException` - the 409 twin of `FieldValidationException`) when a `pending`/`approved` request for the email already exists; `rejected` (unless blacklisted) and `cancelled` requests are reset to `pending` by re-submitting via `POST`. Cancelled requests cannot be approved and block `POST /auth/register` until re-requested.

Users and registration requests carry a `role` (`UserRole`: `Admin`, `Resident`, `Guest`):

- **Admin** - full access (bypasses all `@ForRoles` checks). Assigned automatically on TOTP registration.
- **Resident** - manages devices and scenarios (`@ForRoles(UserRole.Resident)` on those controllers).
- **Guest** - default role for new registration requests; limited access.

Restrict endpoints with `@ForRoles(...)` from `auth/decorators`. `RolesGuard` only lets a request through when the user is an `Admin` or their role is listed in `@ForRoles(...)`, so an authenticated non-admin is rejected on an endpoint without the decorator - every non-admin endpoint must list its roles explicitly (e.g. `@ForRoles(UserRole.Resident, UserRole.Guest)` on `GET /users/me`). Admins can assign the role granted on approval via the `role` field of `PUT /auth/register/requests/{externalId}`; the new user inherits the registration request's role.

### Google Sign-In

The hub verifies **Google ID tokens** instead of running the OAuth redirect flow: the client (WEB or IOS app) performs the Google Sign-In itself and posts the resulting `idToken`. A self-hosted hub has no stable public address, so registering an OAuth redirect URI per installation is not practical, and the ID token flow needs no client secret.

This is also why there is **no `passport-google-oauth20` strategy**, even though the JWT authentication is Passport-based. That strategy implements the browser redirect (authorization code) flow: it needs a client secret and a publicly reachable `/auth/google/callback` URI registered in the Google console for every hub installation, and it ends with a redirect the native apps would have to intercept. The apps already hold a signed ID token, so all that is left for the hub is to verify its signature and audience - a single `google-auth-library` call with no session or redirect state, which a Passport strategy would only wrap without adding anything.

`GOOGLE_CLIENT_ID` holds the OAuth client IDs of the **hub client apps** (the WEB and IOS apps), not of the people signing in - nothing has to be configured per household member. Anyone can open the app, sign in with their own Google account, and the hub registers them as long as their email has an approved registration request. The value is a public identifier shipped inside the apps (not a secret) and is set once, when the hub is installed. It cannot be dropped either: it is the `audience` the ID token is checked against, and without it a token that Google issued to any other application would be accepted here.

`GoogleAuthService` (`auth/google-auth.service.ts`) resolves the user for the verified profile:

1. The user already linked to the Google account (`users.googleIdHash`, a unique sparse index) is signed in.
2. Otherwise a user with the same email is linked to the Google account automatically - Google has verified the email ownership. A user already linked to a _different_ Google account gets a **409 Conflict**.
3. Otherwise a new user is registered, but only when the email has an **approved registration request** - the Google sign-up follows the same approval policy as the credentials one (`RegistrationRequestsService.getApprovedRequestByEmail`, shared by both flows).

The Google account id (the token `sub` claim) is stored **hashed** with SHA-256: it is only ever compared for equality, so keeping it recoverable buys nothing while a leaked database would otherwise reveal which Google accounts the hub users own.

Users registered through Google have **no password** (`users.password` is only required when there is no `googleIdHash`), so `PUT /auth/login` rejects them and `DELETE /auth/google/link` refuses to unlink until a password is set via the password reset flow. `GET /users/me` exposes `googleLinked`, `googleEmail` and `hasPassword` so a client can tell how the account can be authenticated.

### Local Network Restriction

Endpoints marked with `@Public({ localOnly: true })` (from `auth/decorators`) are rejected with **403 Forbidden** unless the request originates from the local network. This exists so a hub exposed to the internet cannot have its unauthenticated endpoints abused (e.g. registration request spam). `localOnly` defaults to `false`, so a bare `@Public()` stays reachable from anywhere. The restriction is always enforced - there is no env variable to turn it off.

Currently applied to `GET/POST/DELETE /auth/register/requests` (the public ones) and `GET /info`. The login, refresh, register and password restore endpoints stay reachable from anywhere so users can authorize remotely.

`LocalNetworkGuard` (`auth/guards`) does the address matching with `ipaddr.js` by checking the address range against `LOCAL_IP_RANGES` (`auth/auth.constants`): IPv4 loopback/private/link-local, IPv6 loopback/unique-local/link-local. IPv4-mapped IPv6 addresses are unwrapped before matching, and an unresolvable address fails closed.

The client IP comes from `request.ip`, which honors the express `trust proxy` setting, so the restriction works behind a reverse proxy. `TRUST_PROXY` accepts `false`, `true`, a number of proxy hops, or a comma-separated list of trusted proxies/subnets - `true` trusts `X-Forwarded-For` from any client and therefore allows spoofing the client IP, so a hop count or a proxy list should be preferred (the server logs a warning on startup when `TRUST_PROXY=true`).

### Server Discovery

`DiscoveryService` advertises the hub on the local network over **mDNS/DNS-SD** with `bonjour-service`, so clients find it with the platform Bonjour APIs (iOS `NWBrowser`, Android NSD, `dns-sd`, avahi) instead of a custom protocol. The advertised record is `_<SERVER_MDNS_SERVICE_TYPE>._tcp.local` (default type `myhomehub`), the instance name is `SERVER_LABEL`, the SRV port is the externally reachable HTTP port, and the TXT record carries `label`/`address`/`port` - the same fields `GET /info` returns, so resolving the service is enough to reach the hub.

This replaced a UDP broadcast listener that answered a magic `DISCOVERY_MESSAGE` string on `UDP_PORT`; both variables are gone. Clients still on that protocol have to switch to mDNS.

The responder is created with an explicit error callback because the `bonjour-service` default one **rethrows**, which would take the whole app down when something else (a host avahi/mDNSResponder) already holds UDP/5353. Advertisement failures are logged instead, and `SERVER_DISCOVERY_ENABLED=false` turns the advertisement off entirely - it defaults to **on** (only the literal `false` disables it), unlike the opt-in `THROTTLE_ENABLED`/`ENABLE_LOCAL_AUTH` flags, since discovery worked without any configuration before.

mDNS needs multicast on the LAN, which is why the Docker service keeps `network_mode: host`.

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
- `SERVER_DISCOVERY_ENABLED`, `SERVER_MDNS_SERVICE_TYPE` - mDNS advertisement settings
- `JWT_SECRET`, `JWT_EXPIRATION_TIMEOUT` - Access token signing secret and lifetime
- `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRATION_TIMEOUT` - Refresh token signing secret and lifetime
- `PASSWORD_RESET_TOKEN_TTL_SEC` - Password reset token lifetime in seconds (opaque Redis-backed token)
- `GOOGLE_CLIENT_ID` - Comma-separated OAuth client IDs of the hub client apps (one per platform) the Google ID tokens are verified against; set once per installation, nothing is configured per user (empty disables the Google endpoints)
- `REGISTRATION_TOTP_SECRET` - Admin TOTP for user registration and password restore
- `USER_PASSWORD_SECRET`, `USER_PASSWORD_SALT` - Argon2 hashing
- `MONGO_*` - MongoDB connection
- `MQTT_*` - MQTT broker connection
- `REDIS_*` - Redis connection (for rate limiting)
- `THROTTLE_*` - Rate limiting configuration (enabled, TTL/limit for short/medium/long tiers)
- `TRUST_PROXY` - Reverse proxy support used to resolve the real client IP (`false`, `true`, a hops count, or a list of trusted proxies/subnets)
- `DEVICE_CONFIGS_DIR` - Directory with YAML device config files (default `configs/devices`)

### Device Configs

Per-brand YAML files under `configs/devices/<brand>.yaml` declare the metadata (label, type, description, value mappings) for the commands/controls/measurements that the UI can display per device. `DeviceConfigsService` reads the directory on startup and on file changes, then upserts one MongoDB document per `(brand, type, transportProtocol)` combination - stale documents not present in YAML are removed.

Device configs are consumed in five places:

- **Device GET endpoints** (`GET /devices`, `GET /devices/{externalId}`) accept an `includeConfig=true` query parameter. When set, each device response includes a `config` field with the matching config's non-empty `commands`/`controls`/`measurements` sections (omitted entirely when nothing matches).
- **Outgoing payloads**: `DevicesControlService.setControls` passes the transport message payload through `DeviceConfigsMapperService.mapPayloadToDevice`, translating internal command/control names and values to the device-side ones declared via the config `path` fields. Names not present in the config are sent as-is.
- **Incoming payloads**: ESP32 MQTT controls/measurements updates are translated back to internal names via `DeviceConfigsMapperService.mapPayloadFromDevice` (unknown fields kept), and Zigbee (zigbee2mqtt) state updates are categorized into commands/controls/measurements via `categorizeAndMapPayloadFromDevice` (fields that do not match the config - unknown names, or values missing from the item's `values` list - are dropped, and their names logged at debug level).
- **Payload validation**: every controls/measurements/command payload is validated against the config by `DeviceConfigsValidatorService` (see below).
- **Payload seeding**: a new device is created with every control/measurement its config declares, so the supported names are visible right after adding it (see below).

#### Config item rules

Beyond the display metadata, a config item can declare how its value is validated and initialized:

```yaml
led:
    http:
        # Optional, reject names the config does not declare. Default: true.
        strict: true
        controls:
            - label: 'Brightness'
              name: 'brightness'
              # Required, control type: number | boolean | string | enum | object
              type: number
              # Optional, initialized on device creation. Default: null
              default: 50
              # Optional, if true - the item must be present (and non-null) in every payload for its section. Default: false
              required: false
              constraints:
                  # Constraints for number type: min/max/integer
                  min: 0
                  max: 100
                  integer: true
            - label: 'Light color'
              name: 'color'
              type: string
              constraints:
                  # Constraints for string type: minLength/maxLength/pattern/format
                  minLength: 4
                  # Options: hex-color, ip, url
                  format: 'hex-color'
```

`enum` items are validated against the `name` of their declared `values`. `object` items are only checked for being an object - their nested structure is delegated to the brand DTO (e.g. `speedLevels` of `Esp32FansControlsDto`), which is why complex controls can still be declared in YAML.

The rules live in `device-configs/device-config-item.validators.ts` as pure functions, so the parser can reuse them to reject a `default` that violates its own item's constraints at load time.

#### Validation policy

`DeviceConfigsValidatorService` validates the **incoming payload** (not the merged result, so removing an item from YAML never breaks updates on devices that still store it). What happens on a violation depends on where the payload came from, expressed as `DeviceUpdateOrigin` on `updateDevice`/`addDevice`/`sendCommand`:

- `Api` (default, also used by scenarios) - `DeviceConfigValidationPolicy.Throw`: the update is rejected with a `CustomValidationException` listing every violation.
- `Device` (ESP32 MQTT sync, Zigbee state updates, ESP32 pairing) - `DeviceConfigValidationPolicy.Sanitize`: only the offending fields are dropped and logged at debug level, so one bad field never discards a whole state update. `required` presence is not enforced for this origin, because devices report deltas.

All three sections are validated the same way: a device only accepts the items its config declares for the section being written, so an empty section accepts nothing. Validation is skipped only when the device has no config document at all, which keeps a brand unvalidated until its YAML file exists. `strict: false` on a protocol block keeps the value rules but allows undeclared names. There is deliberately no global switch to turn validation off: the config files are watched and re-synced live, so relaxing a rule in YAML applies within seconds and without a restart, which is a faster remedy than any env variable would be.

Commands (`POST /devices/{externalId}/command`) are validated against the `commands` section only - a control is not a command. Note this differs from `DeviceConfigsMapperService.mapPayloadToDevice`, which maps outgoing names against both sections: mapping a superset of names is harmless, deciding what a caller may send is not.

The config is what the API payloads are actually checked against, and it is the only place that can express rules for a brand with no DTO of its own. A brand DTO may still mirror those rules with `class-validator` decorators (e.g. `ShellyLedControlsDto`) to describe its Swagger schema and to keep the instance validatable on its own - when it does, the YAML and the DTO have to be changed together, because both run: the config validates the incoming payload and the DTO validates the merged result. A DTO must also keep whatever YAML cannot express, such as the nested `speedLevels` of `Esp32FansControlsDto`.

#### Payload seeding and reconciliation

`DevicesControlService.applyConfigDefaults` fills a device's `controls`/`measurements` with every name the config declares, using `default` when present and `null` otherwise (`null` means "state not known yet" - a fake `false`/`0` would misreport the device). Values already on the device always win. It runs on `addDevice` and when an update changes the config key (`brand`/`type`/`transportProtocol`).

Because of the seeded nulls, outgoing payloads are passed through `stripEmptyValues` (`devices-control/devices-control.utils.ts`) before reaching a device, both in `setControls` and in the ESP32 pairing reply.

Existing devices are kept in sync by `DevicesService.reconcileDevicePayloads`: it seeds newly declared items and `$unset`s the ones no longer declared, running on every `DeviceConfigsChangedEvent`, which `DeviceConfigsService` emits after each sync - including the initial one on startup. A section the config leaves empty is never touched, so an incomplete config cannot wipe stored state.

## Code Style

- 4-space indentation for TypeScript
- Single quotes, trailing commas
- Max function params: 3
- Max nesting depth: 5
- No console.log (only console.warn/error)
- Camelcase enforced
- Curly braces required

## Capturing Corrections

When the user corrects the way you act - points out a mistake, rejects an approach, or teaches a rule they want followed from now on - after fixing the immediate problem, also update the instruction file that would have prevented the mistake, so the lesson sticks for future sessions. Do this without being asked.

Pick the narrowest file that covers the rule:

- Role-specific guidance (how the Tester writes tests, how the Architect plans, etc.) → the matching file under `.claude/agents/*.md`
- Repo-wide guidance (conventions, commands, architecture, workflow rules) → this `CLAUDE.md`

When writing the update, include **why** (the concrete mistake or reasoning) alongside the rule, so future-you can judge edge cases instead of following it blindly. Skip this step for one-off stylistic nits or purely local fixes that aren't generalizable - only capture corrections that would apply again.
