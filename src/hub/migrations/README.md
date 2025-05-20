# MongoDB Migrations

This is step by step guide on how migrate new/old fields for mongodb instances.

## Log In the docker container

First, you need to log in the mongodb docker container and open `mongosh`:

```bash
docker exec -it mongodb mongosh "connection_string"
```

Where `mongodb` is the name of the docker container, and `connection_string` is the connection url that consists of the following fields:

```text
mongodb://{username}:{password}@{host}:{port}/{dbName}?authSource=admin
```

## Deleting an existing field

To delete an existing field (after the data has been moved somewhere else), you can use the following command:

```bash
db.devices.updateMany({ field_to_delete: { $exists: true } }, { $unset: { field_to_delete: "" } });
```

Where `field_to_delete` is the field that needs replacing (deleting).
