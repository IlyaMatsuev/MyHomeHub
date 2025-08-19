import * as mongoose from 'mongoose';
import { USER_PASSWORD_MAX_LENGTH, USER_PASSWORD_MIN_LENGTH } from 'users/users.constants';

export const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true,
    },
    password: {
        type: String,
        required: true,
        trim: true,
        minLength: USER_PASSWORD_MIN_LENGTH,
        maxLength: USER_PASSWORD_MAX_LENGTH,
    },
});
