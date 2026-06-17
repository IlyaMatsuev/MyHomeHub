import * as mongoose from 'mongoose';
import { UserRole } from 'users/interfaces';
import { DEFAULT_USER_ROLE } from 'users/users.constants';

export const UserSchema = new mongoose.Schema(
    {
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
        role: {
            type: String,
            required: true,
            enum: Object.values(UserRole),
            default: DEFAULT_USER_ROLE,
        },
    },
    { timestamps: true },
);
