# MongoDB Migrations

Each schema change that needs backfilling or restructuring lives as a numbered `mongosh` script in this folder. Scripts run against an already-connected `mongosh` session and are expected to be idempotent - running one twice should be a no-op.

## File convention

```
migrations/
├── 001-users-add-external-id.js
├── 002-<schema>-<short-kebab-case-description>.js
└── ...
```

- **Three-digit prefix** keeps them in execution order.
- **`.js` extension** lets editors syntax-highlight and lets `mongosh` consume the file directly.
- **Header comment** at the top of each file explains _why_ the migration exists (the constraint, ticket, or schema change that made it necessary).
- **Idempotent operations only** - filter with `$exists: false`, rely on `createIndex` being a no-op when the index already exists, etc.

## Running a migration

Pipe the script into a `mongosh` session running inside the docker container:

```bash
docker exec -i mongodb mongosh "connection_string" < migrations/001-users-add-external-id.js
```

Where `mongodb` is the name of the docker container, and `connection_string` is the connection url that consists of the following fields:

```text
mongodb://{username}:{password}@{host}:{port}/{dbName}?authSource=admin
```

For interactive exploration, drop the redirect and use `-it`:

```bash
docker exec -it mongodb mongosh "connection_string"
```
