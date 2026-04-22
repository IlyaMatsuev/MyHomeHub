import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, INestApplication, LogLevel, LoggerService, ValidationPipe, LOG_LEVELS } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsAdapter } from '@nestjs/platform-ws';
import { SwaggerCustomOptions } from '@nestjs/swagger/dist/interfaces/swagger-custom-options.interface';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerDocumentOptions, SwaggerModule } from '@nestjs/swagger';
import { ValidationError as ClassValidationError } from 'class-validator';
import { SwaggerTheme, SwaggerThemeNameEnum } from 'swagger-themes';
import { AppModule } from './app.module';
import { CustomValidationException } from 'common/exceptions';

bootstrap();

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    const config = app.get<ConfigService>(ConfigService);
    app.useLogger(setupLogger(config));
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.MQTT,
        options: {
            protocol: 'mqtt',
            clientId: config.get<string>('MQTT_CLIENT_ID'),
            hostname: config.get<string>('MQTT_DOMAIN'),
            port: +config.get<string>('MQTT_PORT'),
            username: config.get<string>('MQTT_USERNAME'),
            password: config.get<string>('MQTT_PASSWORD'),
        },
    });
    app.enableCors();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            transformOptions: { enableImplicitConversion: true },
            exceptionFactory: (validationErrors: Array<ClassValidationError>) =>
                CustomValidationException.fromClassValidator(validationErrors),
        }),
    );

    setupSwagger(app);

    await app.startAllMicroservices();
    await app.listen(process.env.PORT ?? 3000);
}

function setupLogger(config: ConfigService): LoggerService {
    const defaultLevel: LogLevel = config.get<string>('NODE_ENV') === 'prod' ? 'log' : 'debug';
    let logLevel = config.get<string>('LOG_LEVEL')?.toLowerCase() as LogLevel;
    logLevel = LOG_LEVELS.includes(logLevel) ? logLevel : defaultLevel;

    const logLevels = LOG_LEVELS.slice(LOG_LEVELS.indexOf(logLevel));
    return new ConsoleLogger({ prefix: 'SmartHome Hub', logLevels });
}

function setupSwagger(app: INestApplication) {
    const config = new DocumentBuilder()
        .setTitle('My Smart Home REST API')
        .setDescription('API documentation describing available methods for controlling devices connected to the hub')
        .setVersion('1.0')
        .addServer('http://localhost:3000/', 'Default local server used for development')
        .addBearerAuth()
        .build();

    const documentOptions: SwaggerDocumentOptions = {
        operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    };
    const swaggerOptions: SwaggerCustomOptions = {
        customCss: new SwaggerTheme().getBuffer(SwaggerThemeNameEnum.ONE_DARK),
        customSiteTitle: 'SmartHome REST API',
        swaggerOptions: {
            defaultModelsExpandDepth: 3,
        },
    };
    SwaggerModule.setup('api', app, () => SwaggerModule.createDocument(app, config, documentOptions), swaggerOptions);
}
