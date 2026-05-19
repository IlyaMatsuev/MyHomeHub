import { ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { MQTT_CLIENT_PROVIDER_NAME } from 'mqtt/mqtt.constants';

export const mqttProviders = [
    {
        provide: MQTT_CLIENT_PROVIDER_NAME,
        useFactory: (config: ConfigService) =>
            ClientProxyFactory.create({
                transport: Transport.MQTT,
                options: {
                    protocol: 'mqtt',
                    clientId: config.get<string>('MQTT_CLIENT_SENDER_ID'),
                    hostname: config.get<string>('MQTT_DOMAIN'),
                    port: config.get('MQTT_PORT'),
                    username: config.get('MQTT_USERNAME'),
                    password: config.get('MQTT_PASSWORD'),
                    serializer: {
                        serialize: (packet: { data: unknown }) => JSON.stringify(packet.data),
                    },
                },
            }),
        inject: [ConfigService],
    },
];
