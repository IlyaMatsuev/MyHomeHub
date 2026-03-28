# MQTT Broker (Mosquitto)

## Requisites

In order to store the mosquitto credentials, the password file has to be created under the `mqtt/` folder. The pattern of the file name is the following: `pwfile.env`, where `env` is the alias of one of three environments: `local`, `prod`.

## Running

The broker can be started from the `hub` folder using command:

```shell
# For local development
npm run mqtt:start

# For prod environment
npm run mqtt:start:prod
```

If the container is new, user credentials have to be configured. For that you need to interact with the running container...:

```shell
# `mqtt-broker` is the name of the running container
docker exec -it mqtt-broker sh
```

...And create a new user:

```shell
# `username` is the name of the new user. It will prompt to enter a password as well after that
# I suggest typing password manually instead of pasting from clipboard. The password is saved differently (for some reason) if you try to paste it
mosquitto_passwd -c /mosquitto/config/pwfile username
```

Use `exit` command to log out of the container.

## Configuration

Mosquitto MQTT broker is configured by specifying values in [mosquitto.local.conf](mosquitto.local.conf) (or [mosquitto.prod.conf](mosquitto.prod.conf) for prod environment).

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
