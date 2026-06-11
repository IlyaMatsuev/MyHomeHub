import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, INestApplication, LogLevel, LoggerService, ValidationPipe, LOG_LEVELS } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { SwaggerCustomOptions } from '@nestjs/swagger/dist/interfaces/swagger-custom-options.interface';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerDocumentOptions, SwaggerModule } from '@nestjs/swagger';
import { ValidationError as ClassValidationError } from 'class-validator';
import { SwaggerTheme, SwaggerThemeNameEnum } from 'swagger-themes';
import { AppModule } from './app.module';
import { CustomValidationException } from 'common/exceptions';
import { DEFAULT_PORT, DEFAULT_SERVER_LABEL } from 'common/common.constants';

bootstrap();

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
    app.useStaticAssets(path.join(__dirname, '..', 'public'));

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
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            transformOptions: { enableImplicitConversion: true },
            exceptionFactory: (validationErrors: Array<ClassValidationError>) =>
                CustomValidationException.fromClassValidator(validationErrors),
        }),
    );

    setupSwagger(app, config);

    await app.startAllMicroservices();
    await app.listen(config.get<string>('PORT') ?? DEFAULT_PORT);
}

function setupLogger(config: ConfigService): LoggerService {
    const defaultLevel: LogLevel = config.get<string>('NODE_ENV') === 'prod' ? 'log' : 'debug';
    let logLevel = config.get<string>('LOG_LEVEL')?.toLowerCase() as LogLevel;
    logLevel = LOG_LEVELS.includes(logLevel) ? logLevel : defaultLevel;

    const logLevels = LOG_LEVELS.slice(LOG_LEVELS.indexOf(logLevel));
    return new ConsoleLogger({ prefix: config.get<string>('SERVER_LABEL') ?? DEFAULT_SERVER_LABEL, logLevels });
}

function setupSwagger(app: INestApplication, conf: ConfigService) {
    const port = conf.get<string>('PORT') ?? DEFAULT_PORT;
    const serverLabel = conf.get<string>('SERVER_LABEL') ?? DEFAULT_SERVER_LABEL;
    const config = new DocumentBuilder()
        .setTitle(`${serverLabel} REST API`)
        .setDescription('API documentation describing available methods for controlling devices connected to the hub')
        .setVersion('1.0')
        .addServer(`http://localhost:${port}/`, 'Default local server used for development')
        .addBearerAuth()
        .build();

    const documentOptions: SwaggerDocumentOptions = {
        operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    };
    const swaggerOptions: SwaggerCustomOptions = {
        customCss: new SwaggerTheme().getBuffer(SwaggerThemeNameEnum.ONE_DARK),
        customfavIcon: '/favicon.ico',
        customSiteTitle: `${serverLabel} REST API`,
        swaggerOptions: {
            defaultModelsExpandDepth: 3,
        },
    };
    SwaggerModule.setup('api', app, () => SwaggerModule.createDocument(app, config, documentOptions), swaggerOptions);
}
