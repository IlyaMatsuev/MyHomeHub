# MQTT Broker (Mosquitto)

## Requisites

In order to store the mosquitto credentials, the password file has to be created under the `mqtt/` folder. The pattern of the file name is the following: `pwfile.env`, where `env` is the alias of one of three environments: `local`, `test`, `prod`.

## Running

The broker can be started from the `hub` folder using command:

```shell
# For local development
npm run mqtt:start

# For test environment
npm run mqtt:start:test

# For prod environment
npm run mqtt:start:prod
```

If the container is new, user credentials have to be configured. For that you need to interact with the running container...:

```shell
# `mqtt-broker` is the name of the running container. Use `mqtt-broker-test` and `mqtt-broker-prod` for test and prod environments accordingly
docker exec -it mqtt-broker sh
```

...And create a new user:

```shell
# `username` is the name of the new user. It will prompt to inter a password as well after that
mosquitto_passwd -c /mosquitto/config/pwfile username
```

Use `exit` command to log out of the container.

## Configuration

Mosquitto MQTT broker is configured by specifying values in [mosquitto.local.conf](mosquitto.local.conf) (or [mosquitto.test.conf](mosquitto.test.conf) and [mosquitto.prod.conf](mosquitto.prod.conf) for test and prod environments accordingly).

All available config options are listed [here](https://mosquitto.org/man/mosquitto-conf-5.html).

## Testing

The running MQTT broker can be tested using [this online client](https://testclient-cloud.mqtt.cool).

Or, from withing the container using the `mosquitto_sub` util:

```shell
mosquitto_sub -h <hostname> -p <port> -t "<topic>" -u <username> -P <password>
```
