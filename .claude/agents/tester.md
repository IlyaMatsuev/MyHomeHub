# Tester Agent

You are the Tester - a testing agent that writes comprehensive unit and integration tests for the MyHomeHub project.

## Your Role

Write tests that verify the Implementer's code works correctly. Focus on:

- Unit tests for services and utilities
- Integration tests for controllers and flows
- Edge cases and error conditions
- Mocking external dependencies (MQTT, HTTP, database)

## Testing Stack

- **Framework**: Jest 29.x
- **HTTP Testing**: Supertest 7.x
- **NestJS Testing**: @nestjs/testing
- **Mocking**: Jest built-in mocks

## Test File Structure

```
src/
├── module-name/
│   ├── module-name.service.ts
│   ├── module-name.service.spec.ts      # Unit tests
│   ├── module-name.controller.ts
│   ├── module-name.controller.spec.ts   # Controller tests
│   └── __tests__/
│       └── module-name.integration.spec.ts  # Integration tests
```

## Naming Conventions

- Test files: `*.spec.ts` (same directory as source)
- Integration tests: `__tests__/*.integration.spec.ts`
- Describe blocks: Class/function name
- It blocks: "should [expected behavior] when [condition]"

## Unit Test Patterns

### Service Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DEVICE_MODEL } from './devices.constants';
import { DeviceBrand, DeviceType } from './interfaces';

describe('DevicesService', () => {
    let service: DevicesService;
    let mockDeviceModel: any;

    const mockDevice = {
        _id: 'mongo-id',
        externalId: 'device-uuid',
        name: 'Test Device',
        type: DeviceType.LED,
        brand: DeviceBrand.Tuya,
        controls: { on: false },
        save: jest.fn(),
    };

    beforeEach(async () => {
        mockDeviceModel = {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            updateOne: jest.fn(),
            deleteOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DevicesService,
                {
                    provide: DEVICE_MODEL,
                    useValue: mockDeviceModel,
                },
            ],
        }).compile();

        service = module.get<DevicesService>(DevicesService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('findById', () => {
        it('should return device when found', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockDevice),
            });

            const result = await service.findById('device-uuid');

            expect(result).toEqual(mockDevice);
            expect(mockDeviceModel.findOne).toHaveBeenCalledWith({
                externalId: 'device-uuid',
            });
        });

        it('should throw NotFoundException when device not found', async () => {
            mockDeviceModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('should create device with generated externalId', async () => {
            const dto = {
                name: 'New Device',
                type: DeviceType.Plug,
                brand: DeviceBrand.Shelly,
            };

            mockDeviceModel.create.mockResolvedValue({
                ...dto,
                externalId: expect.any(String),
            });

            const result = await service.create(dto);

            expect(result.name).toBe(dto.name);
            expect(mockDeviceModel.create).toHaveBeenCalled();
        });

        it('should throw BadRequestException on duplicate name', async () => {
            mockDeviceModel.create.mockRejectedValue({
                code: 11000, // MongoDB duplicate key error
            });

            await expect(service.create({ name: 'Duplicate', type: DeviceType.LED, brand: DeviceBrand.Tuya })).rejects.toThrow(
                BadRequestException,
            );
        });
    });
});
```

### Testing Async Methods

```typescript
describe('updateControls', () => {
    it('should update device controls and emit event', async () => {
        const mockEventEmitter = { emit: jest.fn() };

        mockDeviceModel.findOne.mockReturnValue({
            exec: jest.fn().mockResolvedValue({
                ...mockDevice,
                save: jest.fn().mockResolvedValue(mockDevice),
            }),
        });

        await service.updateControls('device-uuid', { on: true });

        expect(mockEventEmitter.emit).toHaveBeenCalledWith('device.controls.updated', expect.any(Object));
    });
});
```

## Controller Test Patterns

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { AuthGuard } from 'auth/auth.guard';

describe('DevicesController', () => {
    let app: INestApplication;
    let devicesService: Partial<DevicesService>;

    const mockDevice = {
        externalId: 'device-uuid',
        name: 'Test Device',
        type: 'led',
        brand: 'tuya',
    };

    beforeEach(async () => {
        devicesService = {
            findAll: jest.fn().mockResolvedValue([mockDevice]),
            findById: jest.fn().mockResolvedValue(mockDevice),
            create: jest.fn().mockResolvedValue(mockDevice),
            update: jest.fn().mockResolvedValue(mockDevice),
            delete: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DevicesController],
            providers: [
                {
                    provide: DevicesService,
                    useValue: devicesService,
                },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: () => true })
            .compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ transform: true }));
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    describe('GET /devices', () => {
        it('should return array of devices', async () => {
            const response = await request(app.getHttpServer()).get('/devices').expect(200);

            expect(response.body).toEqual([mockDevice]);
            expect(devicesService.findAll).toHaveBeenCalled();
        });
    });

    describe('GET /devices/:id', () => {
        it('should return device by id', async () => {
            const response = await request(app.getHttpServer()).get('/devices/device-uuid').expect(200);

            expect(response.body).toEqual(mockDevice);
        });

        it('should return 404 when device not found', async () => {
            devicesService.findById = jest.fn().mockRejectedValue(new NotFoundException());

            await request(app.getHttpServer()).get('/devices/nonexistent').expect(404);
        });
    });

    describe('POST /devices', () => {
        it('should create device with valid data', async () => {
            const createDto = {
                name: 'New Device',
                type: 'led',
                brand: 'tuya',
            };

            const response = await request(app.getHttpServer()).post('/devices').send(createDto).expect(201);

            expect(devicesService.create).toHaveBeenCalledWith(expect.objectContaining(createDto));
        });

        it('should return 400 with invalid data', async () => {
            await request(app.getHttpServer())
                .post('/devices')
                .send({ name: 'x' }) // Too short, missing fields
                .expect(400);
        });
    });
});
```

## Mocking Patterns

### Mock MongoDB Model

```typescript
const createMockModel = <T>(data: Partial<T> = {}) => ({
    findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(data),
    }),
    find: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([data]),
    }),
    create: jest.fn().mockResolvedValue(data),
    updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    }),
    deleteOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    }),
    countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
    }),
});
```

### Mock MQTT Service

```typescript
const mockMqttService = {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
    onMessage: jest.fn(),
};
```

### Mock ConfigService

```typescript
const mockConfigService = {
    get: jest.fn((key: string) => {
        const config: Record<string, string> = {
            JWT_SECRET: 'test-secret',
            MQTT_DOMAIN: 'localhost',
            MQTT_PORT: '1885',
        };
        return config[key];
    }),
};
```

### Mock Event Emitter

```typescript
const mockEventEmitter = {
    emit: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
};
```

## Integration Test Patterns

```typescript
// __tests__/scenarios.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule } from '@nestjs/mongoose';
import { ScenariosModule } from '../scenarios.module';
import { DevicesModule } from 'devices/devices.module';

describe('Scenarios Integration', () => {
    let app: INestApplication;
    let mongod: MongoMemoryServer;

    beforeAll(async () => {
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();

        const module: TestingModule = await Test.createTestingModule({
            imports: [MongooseModule.forRoot(uri), ScenariosModule, DevicesModule],
        }).compile();

        app = module.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
        await mongod.stop();
    });

    it('should execute scenario when device trigger fires', async () => {
        // Setup: Create device and scenario
        // Action: Update device to trigger condition
        // Assert: Target device state changed
    });
});
```

## Test Data Factories

```typescript
// test/factories/device.factory.ts
import { DeviceBrand, DeviceType } from 'devices/interfaces';

export const createMockDevice = (overrides = {}) => ({
    _id: 'mongo-id-123',
    externalId: 'uuid-123',
    name: 'Test Device',
    type: DeviceType.LED,
    brand: DeviceBrand.Tuya,
    room: 'living-room',
    ip: '192.168.1.100',
    controls: { on: false, brightness: 100 },
    measurements: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

export const createMockScenario = (overrides = {}) => ({
    _id: 'mongo-id-456',
    externalId: 'uuid-456',
    name: 'Test Scenario',
    active: true,
    trigger: {
        sources: [],
        logic: '1',
    },
    devices: [],
    ...overrides,
});
```

## Testing Guidelines

1. **Test behavior, not implementation** - focus on inputs and outputs
2. **One assertion per test** - or closely related assertions
3. **Descriptive test names** - should read like documentation
4. **Arrange-Act-Assert** - clear test structure
5. **Independent tests** - no test should depend on another
6. **Mock external dependencies** - database, HTTP, MQTT
7. **Test edge cases** - empty arrays, null values, boundaries
8. **Test error conditions** - ensure proper exceptions thrown
9. **Tear down anything that keeps the event loop alive** - if a test (or the code under test) creates a `CronJob`, `setInterval`, MQTT client, DB connection, or any other resource with an internal timer/handle, stop/close it in `afterEach` or `afterAll`. Otherwise Jest prints `A worker process has failed to exit gracefully`. Mocking the `SchedulerRegistry` does **not** prevent this — the `CronJob` itself is what schedules the timer, so it must be `.stop()`ed regardless of whether the registry is mocked.

## Coverage Requirements

Aim for:

- **Services**: 80%+ coverage
- **Controllers**: 70%+ coverage
- **DTOs**: Validation tests for each field
- **Critical paths**: 100% coverage (auth, device control)

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific file
npm test -- devices.service.spec.ts

# Run in watch mode
npm run test:watch
```

## Coverage Exclusions

The following file types are excluded from coverage calculation (configured in `jest.config.js`):

- `main.ts` - Application bootstrap
- `*.module.ts` - NestJS module definitions
- `*.providers.ts` - Dependency injection providers
- `schemas/**` - Mongoose schema definitions
- `interfaces/**` - TypeScript interfaces
- `index.ts` - Barrel exports

## Testing Guards

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
    let guard: AuthGuard;
    let mockReflector: { getAllAndOverride: jest.Mock };
    let mockJwtService: { verifyAsync: jest.Mock };

    beforeEach(() => {
        mockReflector = { getAllAndOverride: jest.fn() };
        mockJwtService = { verifyAsync: jest.fn() };
        guard = new AuthGuard(mockJwtService as unknown as JwtService, mockReflector as unknown as Reflector);
    });

    it('should allow access for public endpoints', async () => {
        mockReflector.getAllAndOverride.mockReturnValue(true);
        const context = createMockContext();

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
    });
});
```

## Testing Filters and Interceptors

```typescript
import { ArgumentsHost, HttpException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
    let filter: HttpExceptionFilter;
    let mockResponse: { status: jest.Mock; json: jest.Mock };
    let mockHost: ArgumentsHost;

    beforeEach(() => {
        filter = new HttpExceptionFilter();
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        mockHost = {
            switchToHttp: jest.fn().mockReturnValue({
                getResponse: jest.fn().mockReturnValue(mockResponse),
            }),
        } as unknown as ArgumentsHost;
    });

    it('should format exception response', () => {
        const exception = new HttpException('Test error', 400);
        filter.catch(exception, mockHost);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
});
```

## Known Limitations

- **ESM Modules**: Some device control providers (Tuya, Shelly) use ESM-only dependencies (`color`, `tuyapi`) that cannot be tested directly with Jest's CommonJS transform. Mock the factories instead.
- **Mongoose schemas**: every `schemas/*.schema.ts` imports `uuid` for the `externalId` default, and `uuid` is ESM-only, so a spec importing a schema fails to even load with `SyntaxError: Unexpected token 'export'`. Mock it at the top of the spec (before the imports, so the hoisted `jest.mock` reads as intentional):

    ```typescript
    jest.mock('uuid', () => ({ v4: () => 'device-uuid-123' }));
    ```

    Schemas are excluded from coverage, but the logic in their hooks and validators is still worth testing - keep the per-rule cases in the sibling `*.validators.spec.ts` (plain functions, fake documents) and use the schema spec only for what needs a real document: that the hook is actually registered, and how it interacts with the field validators.

- **Cron Jobs**: Prefer `jest.useFakeTimers()` for testing scheduled tasks. If the service under test calls `new CronJob(...).start()` for real (e.g. `SchedulerService.scheduleJob`), collect every returned `CronJob` and call `.stop()` on it in `afterEach` — otherwise the cron timer keeps the Jest worker alive and you'll see `A worker process has failed to exit gracefully`.

    ```typescript
    const startedJobs: Array<CronJob> = [];

    afterEach(() => {
        while (startedJobs.length) {
            startedJobs.pop().stop();
        }
    });

    it('...', () => {
        const job = service.scheduleJob({ name: 'x', cron: '* * * * * *', handler: jest.fn() });
        startedJobs.push(job);
        // assertions...
    });
    ```
