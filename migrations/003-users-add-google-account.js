// Adds the unique index for the "googleId" field introduced with the Google sign-in support.
// The index is sparse, so the users without a linked Google account (no "googleId" field) are not indexed
// and therefore don't collide with each other.

db.users.createIndex({ googleId: 1 }, { unique: true, sparse: true });
