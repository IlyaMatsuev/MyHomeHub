import * as mongoose from 'mongoose';

export const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true,
    },
    // No "length" constraints because the password is stored as hash
    password: {
        type: String,
        required: true,
        trim: true,
    },
});
