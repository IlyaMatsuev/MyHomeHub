// Backfill users.externalId for documents created before the field existed.

db.users.find({ externalId: { $exists: false } }).forEach(doc => {
    db.users.updateOne({ _id: doc._id }, { $set: { externalId: crypto.randomUUID() } });
});

db.users.createIndex({ externalId: 1 }, { unique: true });
