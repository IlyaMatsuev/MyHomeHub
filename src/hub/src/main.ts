import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, SwaggerDocumentOptions } from '@nestjs/swagger';
import { AppModule } from './app.module';

const DEFAULT_PORT = 3000;

bootstrap();

async function bootstrap() {
    // TODO: Consider using fastify
    const app = await NestFactory.create(AppModule);
    setupSwagger(app);
    await app.listen(process.env.PORT ?? DEFAULT_PORT);
}

function setupSwagger(app: INestApplication) {
    const config = new DocumentBuilder()
        .setTitle('My Smart Home API')
        .setDescription('My Smart Home API Description')
        .setVersion('1.0')
        .build();

    const options: SwaggerDocumentOptions = {
        operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    };

    SwaggerModule.setup('api', app, () => SwaggerModule.createDocument(app, config, options));
}
