// Sets the new "role" on the users as "Admin" (since it's still in development)

db.users.updateMany({ role: { $exists: false } }, { $set: { role: 'admin' } });
