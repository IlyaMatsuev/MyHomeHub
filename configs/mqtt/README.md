# MQTT Broker (Mosquitto)

## Requisites

In order to store the mosquitto credentials, the password file has to be created under the `mqtt/` folder. The pattern of the file name is the following: `pwfile.env`, where `env` is the alias of one of three environments: `local`, `prod`.

## Running

The broker can be started from the `hub` folder using command: `npm run mqtt:start`

If the container is new, user credentials have to be configured. Create a new user with this script:

```shell
npm run mqtt:user:new -- myusername mypassword
```

## Configuration

Mosquitto MQTT broker is configured by specifying values in [mosquitto.conf](mosquitto.conf).

All available config options are listed [here](https://mosquitto.org/man/mosquitto-conf-5.html).

## Testing

The running MQTT broker can be tested using [this online client](https://testclient-cloud.mqtt.cool).

Or, from withing the container using the `mosquitto_sub` util:

To look into the container:

```shell
docker exec -it mqtt-broker sh
```

To subscribe to the `<topic>` topic:

```shell
mosquitto_sub -h <hostname> -p <port> -t "<topic>" -u <username> -P <password>
```

To publish a message to the `<topic>` topic:

```shell
mosquitto_pub -h <hostname> -p <port> -t "<topic>" -u <username> -P <password> -i <client-name> -m "<message>"
```
