import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { SwaggerModule, DocumentBuilder, SwaggerDocumentOptions } from '@nestjs/swagger';
import { SwaggerTheme, SwaggerThemeNameEnum } from 'swagger-themes';
import { AppModule } from './app.module';
import { SwaggerCustomOptions } from '@nestjs/swagger/dist/interfaces/swagger-custom-options.interface';

bootstrap();

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    app.useWebSocketAdapter(new WsAdapter(app));

    setupSwagger(app);
    await app.listen(process.env.PORT ?? 3000);
}

function setupSwagger(app: INestApplication) {
    const config = new DocumentBuilder()
        .setTitle('My Smart Home REST API')
        .setDescription('API documentation describing available methods for controlling devices connected to the hub')
        .setVersion('1.0')
        .addServer('http://localhost:3000/', 'Default local server used for development')
        .addServer('http://localhost:3010/', 'Server instance used for testing')
        .addBearerAuth()
        .build();

    const documentOptions: SwaggerDocumentOptions = {
        operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    };
    const swaggerOptions: SwaggerCustomOptions = {
        customCss: new SwaggerTheme().getBuffer(SwaggerThemeNameEnum.ONE_DARK),
        customSiteTitle: 'smarthome REST API',
        swaggerOptions: {
            defaultModelsExpandDepth: 3,
        },
    };
    SwaggerModule.setup('api', app, () => SwaggerModule.createDocument(app, config, documentOptions), swaggerOptions);
}
