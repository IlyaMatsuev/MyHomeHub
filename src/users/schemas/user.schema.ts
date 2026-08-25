import * as mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from 'users/interfaces';
import { DEFAULT_USER_ROLE } from 'users/users.constants';

export const UserSchema = new mongoose.Schema(
    {
        externalId: {
            type: String,
            required: true,
            unique: true,
            default: uuidv4,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            index: true,
        },
        // No "length" constraints because the password is stored as hash.
        // Only required for manual registration
        password: {
            type: String,
            required: function () {
                return !this.googleIdHash;
            },
            trim: true,
        },
        role: {
            type: String,
            required: true,
            enum: Object.values(UserRole),
            default: DEFAULT_USER_ROLE,
        },
        // SHA-256 hash of the "sub" claim of the linked Google account
        googleIdHash: {
            type: String,
            required: false,
            trim: true,
            unique: true,
            sparse: true,
        },
        googleEmail: {
            type: String,
            required: false,
            trim: true,
            lowercase: true,
        },
    },
    { timestamps: true },
);
