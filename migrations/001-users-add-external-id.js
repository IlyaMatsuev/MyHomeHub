// Backfill users.externalId for documents created before the field existed.

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

print(uuidv4());

db.users.find({ externalId: { $exists: false } }).forEach(doc => {
    db.users.updateOne({ _id: doc._id }, { $set: { externalId: uuidv4() } });
});

db.users.createIndex({ externalId: 1 }, { unique: true });
