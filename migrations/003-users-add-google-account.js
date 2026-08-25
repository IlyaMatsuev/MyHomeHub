// Adds the unique index for the "googleIdHash" field introduced with the Google sign-in support.
// The index is sparse, so the users without a linked Google account (no "googleIdHash" field) are not indexed
// and therefore don't collide with each other.

db.users.createIndex({ googleIdHash: 1 }, { unique: true, sparse: true });
